import Dexie, { Table } from 'dexie';
import { ProjectDocument } from '../../domain/schemas/types';

export interface StoredProject extends ProjectDocument {
  lastOpenedAt: string;
}

class SoapFlowDatabase extends Dexie {
  projects!: Table<StoredProject, string>;

  constructor() {
    super('soapflow-studio');
    this.version(1).stores({
      projects: 'id, updatedAt, lastOpenedAt, name',
    });
  }
}

export const db = new SoapFlowDatabase();
