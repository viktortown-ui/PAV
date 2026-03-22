import Dexie, { Table } from 'dexie';
import { ProjectDocument } from '../../domain/schemas/types';
import { APP_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION, demoProject } from '../../domain/templates/templates';
import { restoreProjectDocument } from '../../domain/validation/validateProject';

const DB_NAME = 'soapflow-studio';
const STORAGE_VERSION_KEY = 'soapflow-studio:persistence-version';

export interface StoredProject extends ProjectDocument {
  lastOpenedAt: string;
  persistenceVersion: number;
}

interface LoadStoredProjectResult {
  project?: ProjectDocument;
  recovered: boolean;
  resetReason?: 'version-mismatch' | 'corrupted';
}

class SoapFlowDatabase extends Dexie {
  projects!: Table<StoredProject, string>;
  constructor() {
    super(DB_NAME);
    this.version(1).stores({ projects: 'id, updatedAt, lastOpenedAt, name, persistenceVersion' });
  }
}

export const db = new SoapFlowDatabase();
export const getPersistenceSchemaVersion = () => APP_SCHEMA_VERSION * 100 + PROJECT_SCHEMA_VERSION;
const getStoredVersion = () => Number(globalThis.localStorage?.getItem(STORAGE_VERSION_KEY) ?? 0);
const setStoredVersion = (version: number) => globalThis.localStorage?.setItem(STORAGE_VERSION_KEY, String(version));

export const saveStoredProject = async (project: ProjectDocument) => {
  const timestamp = new Date().toISOString();
  await db.projects.put({ ...project, lastOpenedAt: timestamp, updatedAt: timestamp, persistenceVersion: getPersistenceSchemaVersion() });
  setStoredVersion(getPersistenceSchemaVersion());
};

export const resetCurrentProjectState = async () => {
  await saveStoredProject(structuredClone(demoProject));
};

export const clearUserData = async () => {
  await db.projects.clear();
  globalThis.localStorage?.removeItem('soapflow-studio:viewport');
  globalThis.localStorage?.removeItem('soapflow-studio:last-template');
  setStoredVersion(getPersistenceSchemaVersion());
};

export const clearPersistedState = async () => {
  await db.delete();
  globalThis.localStorage?.clear();
  setStoredVersion(getPersistenceSchemaVersion());
};

export const loadStoredProject = async (id?: string): Promise<LoadStoredProjectResult> => {
  const expectedVersion = getPersistenceSchemaVersion();
  if (getStoredVersion() > 0 && getStoredVersion() !== expectedVersion) {
    await clearPersistedState();
    return { recovered: true, resetReason: 'version-mismatch' };
  }

  const stored = id ? await db.projects.get(id) : await db.projects.orderBy('lastOpenedAt').last();
  if (!stored) {
    setStoredVersion(expectedVersion);
    return { recovered: false };
  }

  if (stored.persistenceVersion !== expectedVersion || stored.appSchemaVersion !== APP_SCHEMA_VERSION || stored.projectSchemaVersion !== PROJECT_SCHEMA_VERSION) {
    await clearPersistedState();
    return { recovered: true, resetReason: 'version-mismatch' };
  }

  try {
    const project = restoreProjectDocument(stored);
    setStoredVersion(expectedVersion);
    return { project, recovered: false };
  } catch {
    await clearPersistedState();
    return { recovered: true, resetReason: 'corrupted' };
  }
};
