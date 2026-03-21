import Dexie, { Table } from 'dexie';
import { ProjectDocument } from '../../domain/schemas/types';
import { getPersistenceSchemaVersion, restoreProjectDocument } from '../../domain/validation/validateProject';

const DB_NAME = 'soapflow-studio';
const STORAGE_VERSION_KEY = 'soapflow-studio:persistence-version';

export interface StoredProject extends ProjectDocument {
  lastOpenedAt: string;
  persistenceVersion: number;
}

interface LoadStoredProjectResult {
  project?: ProjectDocument;
  recovered: boolean;
}

class SoapFlowDatabase extends Dexie {
  projects!: Table<StoredProject, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      projects: 'id, updatedAt, lastOpenedAt, name',
    });
    this.version(2).stores({
      projects: 'id, updatedAt, lastOpenedAt, name, persistenceVersion',
    }).upgrade((tx) => tx.table('projects').toCollection().modify((project: Partial<StoredProject>) => {
      project.persistenceVersion = getPersistenceSchemaVersion();
    }));
  }
}

export const db = new SoapFlowDatabase();

const getStoredVersion = () => Number(globalThis.localStorage?.getItem(STORAGE_VERSION_KEY) ?? 0);
const setStoredVersion = (version: number) => globalThis.localStorage?.setItem(STORAGE_VERSION_KEY, String(version));

const purgeForVersionMismatch = async () => {
  await db.projects.clear();
  setStoredVersion(getPersistenceSchemaVersion());
};

export const saveStoredProject = async (project: ProjectDocument) => {
  const timestamp = new Date().toISOString();
  await db.projects.put({ ...project, lastOpenedAt: timestamp, updatedAt: timestamp, persistenceVersion: getPersistenceSchemaVersion() });
  setStoredVersion(getPersistenceSchemaVersion());
};

export const loadStoredProject = async (id?: string): Promise<LoadStoredProjectResult> => {
  const expectedVersion = getPersistenceSchemaVersion();
  if (getStoredVersion() > 0 && getStoredVersion() !== expectedVersion) {
    await purgeForVersionMismatch();
    return { recovered: true };
  }

  const stored = id ? await db.projects.get(id) : await db.projects.orderBy('lastOpenedAt').last();
  if (!stored) {
    setStoredVersion(expectedVersion);
    return { recovered: false };
  }

  if (stored.persistenceVersion !== expectedVersion) {
    await purgeForVersionMismatch();
    return { recovered: true };
  }

  try {
    const project = restoreProjectDocument(stored);
    setStoredVersion(expectedVersion);
    return { project, recovered: false };
  } catch (error) {
    console.warn('Discarding corrupted persisted project', error);
    await clearPersistedState();
    return { recovered: true };
  }
};

export const clearPersistedState = async () => {
  await db.projects.clear();
  await db.delete();
  globalThis.localStorage?.clear();
  setStoredVersion(getPersistenceSchemaVersion());
};
