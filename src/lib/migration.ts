import { loadWorkspace } from './localStore';
import { cloudStore } from './cloudStore';
import { addToast } from './toast';

export async function migrateLocalStorageToCloud(): Promise<boolean> {
  try {
    const localWorkspace = loadWorkspace();
    
    if (!localWorkspace || !localWorkspace.tasks || !localWorkspace.users) {
      console.log('No local workspace data to migrate');
      return false;
    }

    console.log('Starting migration from localStorage to cloud...');
    addToast('Migrating your data to cloud storage...', 'info', 5000);

    await cloudStore.init();
    await cloudStore.migrateFromLocal(localWorkspace);

    console.log('Migration completed successfully');
    addToast('Data successfully migrated to cloud! All changes are now synced.', 'success', 6000);
    
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    addToast('Cloud migration failed. Some data may not sync properly.', 'error', 6000);
    return false;
  }
}
