import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function seedInitialData() {
  const companiesSnapshot = await getDocs(collection(db, 'companies'));
  if (companiesSnapshot.empty) {
    console.log('Seeding initial companies...');
    const companies = [
      { name: 'Grand Community', type: 'Client', country: 'Saudi Arabia', city: 'Riyadh' },
      { name: 'TryGC', type: 'Brand', country: 'UAE', city: 'Dubai' },
      { name: 'Loreal', type: 'Client', country: 'France', city: 'Paris' },
      { name: 'Nike', type: 'Brand', country: 'USA', city: 'Beaverton' },
    ];

    for (const company of companies) {
      await addDoc(collection(db, 'companies'), company);
    }
    console.log('Seeding complete.');
  }
}
