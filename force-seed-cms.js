import admin from './firebase-admin.js';

const seedCMS = async () => {
  try {
    const db = admin.firestore();

    const homepageRef = db.collection('cms').doc('homepage');
    await homepageRef.set({
      ambassadors: {
        enabled: true,
        list: [
          {
            id: 'a1',
            image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/GlamirkBanner%2FB2ww1.jpeg?alt=media&token=bec6b345-ab9f-49ac-9cc1-4cd782bd2c68', // Just using an existing image for demo
            name: 'Selena Gomez',
            title: 'The New Frontier of Beauty.',
            description: 'Discover the collection curated by our global ambassador.',
            ctaText: 'Shop the Edit',
            ctaLink: '/shop',
            alignment: 'right'
          }
        ]
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const siteSettingsRef = db.collection('cms').doc('siteSettings');
    await siteSettingsRef.set({
      theme: 'light',
      logoIcon: '/assets/logo-icon.svg',
      logoLight: '/assets/logo-light.svg',
      logoDark: '/assets/logo-dark.svg',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('Successfully seeded CMS data for Ambassador and Logos!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed CMS:', error);
    process.exit(1);
  }
};

seedCMS();
