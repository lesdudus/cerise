import { initialState, validateState } from './model.mjs';
import { mergeJournal, sameState } from './cloud-state.mjs';

export const cloudKey = owner => `cerise.cloud.v1.${owner}`;

export function createCloudRepository({ owner, storage, transport, notify = () => {}, lock = (_name, action) => action() }) {
  const key = cloudKey(owner);
  let active = true;
  let running;
  let timer;
  let status = 'En attente de synchronisation';
  const read = () => {
    const raw = storage.getItem(key);
    if (raw === null) return { version: 1, revision: 0, base: initialState(), state: initialState(), conflict: null };
    const record = JSON.parse(raw);
    if (record.version !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 0) throw new Error('Brouillon local invalide.');
    record.base = validateState(record.base);
    record.state = validateState(record.state);
    if (record.conflict) {
      record.conflict.state = validateState(record.conflict.state);
      if (!Number.isSafeInteger(record.conflict.revision) || record.conflict.revision < 0) throw new Error('Conflit local invalide.');
    }
    return record;
  };
  const write = record => storage.setItem(key, JSON.stringify(record));
  const emit = () => { if (active) notify(status); };
  const schedule = () => {
    clearTimeout(timer);
    if (active) timer = setTimeout(() => repository.sync(), 700);
  };
  const snapshot = value => {
    if (!Number.isSafeInteger(value?.revision) || value.revision < 0) throw new Error('Réponse serveur invalide.');
    return { revision: value.revision, state: validateState(value.state) };
  };
  const repository = {
    key,
    load: () => read().state,
    details: () => ({ ...read(), status }),
    save(state) {
      if (!active) throw new Error('Compte déconnecté.');
      const record = read();
      record.state = validateState(state);
      write(record);
      status = record.conflict ? 'Conflit à résoudre' : 'Enregistré ici · synchronisation en attente';
      emit();
      schedule();
      return record.state;
    },
    update(change) { return this.save(change(this.load())); },
    async sync() {
      if (!active) return;
      if (running) return running;
      clearTimeout(timer);
      running = lock(key, async () => {
        if (!active) return;
        try {
          status = 'Synchronisation en cours';
          emit();
          const remote = snapshot(await transport.read());
          if (!active) return;
          const latest = read();
          const merged = mergeJournal(latest.base, latest.state, remote.state);
          if (merged.conflicts.length) {
            latest.conflict = { ...remote, fields: merged.conflicts };
            write(latest);
            status = 'Conflit à résoudre';
            return;
          }
          const record = { version: 1, base: remote.state, revision: remote.revision, state: merged.state, conflict: null };
          write(record);
          if (!sameState(record.state, remote.state)) {
            const saved = snapshot(await transport.save(remote.revision, record.state, crypto.randomUUID()));
            if (!active) return;
            const current = read();
            const after = mergeJournal(record.state, current.state, saved.state);
            write({ version: 1, revision: saved.revision, base: saved.state, state: after.state,
              conflict: after.conflicts.length ? { ...saved, fields: after.conflicts } : null });
          }
          const final = read();
          status = sameState(final.state, final.base) ? 'Synchronisé' : 'Enregistré ici · synchronisation en attente';
          if (!sameState(final.state, final.base)) schedule();
        } catch (error) {
          status = error.code === '40001' ? 'Une autre sauvegarde est arrivée · réessayer' : 'Synchronisation indisponible · brouillon conservé';
        } finally { emit(); }
      }).finally(() => { running = null; });
      return running;
    },
    resolve(choice) {
      if (!['local', 'remote'].includes(choice)) throw new Error('Choix invalide.');
      const record = read();
      if (!record.conflict) return;
      const remote = record.conflict;
      const merged = choice === 'local'
        ? mergeJournal(record.base, record.state, remote.state)
        : mergeJournal(record.base, remote.state, record.state);
      write({ version: 1, revision: remote.revision, base: remote.state, state: merged.state, conflict: null });
      status = 'En attente de synchronisation';
      emit();
      schedule();
    },
    dispose() { active = false; clearTimeout(timer); },
  };
  return repository;
}