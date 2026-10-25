import * as dotenv from 'dotenv';
dotenv.config();

// We must dynamically import the firebase config AFTER dotenv is configured!
async function clearMemories() {
  console.log("Connecting to Firestore to delete dummy data...");
  try {
    const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
    const { db } = await import('./src/firebase/config');
    
    const colRef = collection(db, 'memories');
    const snapshot = await getDocs(colRef);
    let count = 0;
    
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, 'memories', d.id));
      count++;
    }
    
    console.log(`Successfully deleted ${count} dummy memories from Firestore!`);
  } catch (err) {
    console.error("Error deleting memories:", err);
  }
}

clearMemories().then(() => {
  console.log("Done.");
  process.exit(0);
});
