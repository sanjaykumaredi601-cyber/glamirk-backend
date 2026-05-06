import { admin, db } from './firebase-admin.js';

const seedAmbassadors = async () => {
  try {
    const homepageRef = db.collection('cms').doc('homepage');
    
    await homepageRef.set({
      ambassadors: {
        enabled: true,
        list: [
          {
            id: 'a1',
            image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/GlamirkBanner%2FB2ww1.jpeg?alt=media&token=bec6b345-ab9f-49ac-9cc1-4cd782bd2c68',
            name: 'Selena Gomez',
            title: 'The New Frontier of Beauty.',
            description: 'Discover the collection curated by our global ambassador. A fusion of elegance and modern skincare innovation.',
            ctaText: 'Shop the Edit',
            ctaLink: '/shop',
            alignment: 'right'
          },
          {
            id: 'a2',
            image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/GlamirkBanner%2FB2ww.jpeg?alt=media&token=21e801af-23b5-4067-8571-fd82cb666d15',
            name: 'Zendaya',
            title: 'Redefining Luxury Skincare.',
            description: 'Every product tells a story of sophistication and radiance. Experience the art of self-care.',
            ctaText: 'Explore Collection',
            ctaLink: '/shop',
            alignment: 'left'
          }
        ]
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('✅ Successfully seeded 2 ambassadors with real images!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed ambassadors:', error);
    process.exit(1);
  }
};

seedAmbassadors();
