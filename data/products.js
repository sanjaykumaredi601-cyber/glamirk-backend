const products = [
  {
    id: 1,
    name: 'Liquid Lipstick',
    tag: 'Lips',
    category: 'lipstick',
    price: 349,
    image: '/images/products/liquid-lipstick-main.png',
    secondaryImage: '/images/products/liquid-lipstick-thumb1.png',
    description: 'A weightless, long-wear liquid lipstick with a soft matte finish. High-pigment color that defines elegance and stays vibrant for up to 12 hours.',
    rating: 4.8,
    reviews: 124,
    shades: [
      { name: 'Berry Glaze', color: '#8E244D', image: '/images/products/liquid-lipstick-main.png', swatch: '/images/products/liquid-lipstick-main.png' }
    ],
    images: [
      '/images/products/liquid-lipstick-main.png',
      '/images/products/liquid-lipstick-thumb1.png',
      '/images/products/liquid-lipstick-thumb2.jpg'
    ],
    gallery: [
      '/images/products/liquid-lipstick-main.png',
      '/images/products/liquid-lipstick-thumb1.png',
      '/images/products/liquid-lipstick-thumb2.jpg'
    ],
    videos: [],
    isBestSeller: true,
    isFeatured: true
  },
  {
    id: 2,
    name: 'Liquid Eyeliner – 3.5ml',
    tag: 'Eyes',
    category: 'eyes',
    price: 299,
    image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Eyeliner%2Feyeliner1.jpeg?alt=media&token=d0e47a3a-5be8-4331-8514-b4e4acc96065',
    secondaryImage: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Eyeliner%2Feyelinerwithpack.jpeg?alt=media&token=1fee3834-30c7-4dbe-b453-b6669ead197a',
    description: 'Precision brush-tip liquid liner for sharp wings and long-lasting blacker-than-black finish. Smudge-proof and water-resistant for all-day perfection.',
    rating: 4.9,
    reviews: 86,
    shades: [],
    images: [
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Eyeliner%2Feyeliner1.jpeg?alt=media&token=d0e47a3a-5be8-4331-8514-b4e4acc96065',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Eyeliner%2Feyelinerwithpack.jpeg?alt=media&token=1fee3834-30c7-4dbe-b453-b6669ead197a'
    ],
    gallery: [
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Eyeliner%2Feyeliner1.jpeg?alt=media&token=d0e47a3a-5be8-4331-8514-b4e4acc96065',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Eyeliner%2Feyelinerwithpack.jpeg?alt=media&token=1fee3834-30c7-4dbe-b453-b6669ead197a'
    ],
    videos: []
  },
  {
    id: 3,
    name: 'Mascara – 10ml (Black)',
    tag: 'Eyes',
    category: 'eyes',
    price: 349,
    image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascara1.jpeg?alt=media&token=430ab610-00d3-48c2-ae81-98a5861736e0',
    secondaryImage: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascara.jpeg?alt=media&token=9cf5739e-ed2d-4f77-9865-2af5a390e464',
    description: 'Volumizing mascara that defines each lash with a clump-free, deep black formula. Achieve the ultimate dramatic eye look with ease.',
    rating: 4.7,
    reviews: 52,
    shades: [],
    images: [
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascara1.jpeg?alt=media&token=430ab610-00d3-48c2-ae81-98a5861736e0',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascara.jpeg?alt=media&token=9cf5739e-ed2d-4f77-9865-2af5a390e464',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascarawithpack.jpeg?alt=media&token=cd000bb2-71d7-4734-b78a-d13538bd5342'
    ],
    gallery: [
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascara1.jpeg?alt=media&token=430ab610-00d3-48c2-ae81-98a5861736e0',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascara.jpeg?alt=media&token=9cf5739e-ed2d-4f77-9865-2af5a390e464',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Mascara%2Fmascarawithpack.jpeg?alt=media&token=cd000bb2-71d7-4734-b78a-d13538bd5342'
    ],
    videos: [],
    isBestSeller: true
  },
  {
    id: 'nail-polish-10ml',
    name: '10ml Nail Polish',
    tag: 'Nails',
    category: 'nails',
    price: 149,
    image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3224.JPG?alt=media&token=01cc04a9-c2a8-4519-a2ad-1b213702fa5d',
    secondaryImage: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3226.JPG?alt=media&token=04e8db64-4a78-4df8-9102-609733fb9cb8',
    description: 'High-shine, chip-resistant nail lacquer designed for lasting brilliance. A professional-grade formula that delivers salon-quality results at home.',
    rating: 4.8,
    reviews: 124,
    shades: [
      {
        name: "Royal Gold",
        image: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3224.JPG?alt=media&token=01cc04a9-c2a8-4519-a2ad-1b213702fa5d",
        swatch: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3224.JPG?alt=media&token=01cc04a9-c2a8-4519-a2ad-1b213702fa5d"
      },
      {
        name: "Sky Blue",
        image: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3226.JPG?alt=media&token=04e8db64-4a78-4df8-9102-609733fb9cb8",
        swatch: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3226.JPG?alt=media&token=04e8db64-4a78-4df8-9102-609733fb9cb8"
      },
      {
        name: "Lavender",
        image: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3228.JPG?alt=media&token=34eb9d18-cd15-4084-9fb5-d9c2280f3e4a",
        swatch: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3228.JPG?alt=media&token=34eb9d18-cd15-4084-9fb5-d9c2280f3e4a"
      },
      {
        name: "Hot Pink",
        image: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3230.JPG?alt=media&token=6f420c2a-913d-4cb1-9b0a-39a631154e64",
        swatch: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3230.JPG?alt=media&token=6f420c2a-913d-4cb1-9b0a-39a631154e64"
      },
      {
        name: "Lilac",
        image: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3232.JPG?alt=media&token=d1d34c34-a0ac-4ae2-a342-13b84e61eb27",
        swatch: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3232.JPG?alt=media&token=d1d34c34-a0ac-4ae2-a342-13b84e61eb27"
      }
    ],
    images: [
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3224.JPG?alt=media&token=01cc04a9-c2a8-4519-a2ad-1b213702fa5d",
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3226.JPG?alt=media&token=04e8db64-4a78-4df8-9102-609733fb9cb8",
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3228.JPG?alt=media&token=34eb9d18-cd15-4084-9fb5-d9c2280f3e4a",
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3230.JPG?alt=media&token=6f420c2a-913d-4cb1-9b0a-39a631154e64",
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolish%2F2L1A3232.JPG?alt=media&token=d1d34c34-a0ac-4ae2-a342-13b84e61eb27"
    ],
    videos: []
  },
  {
    id: 5,
    name: '30ml Nail Polish Remover',
    tag: 'Nails',
    category: 'nails',
    price: 99,
    image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolishremover%2Fnailpolremover.jpeg?alt=media&token=16f127ff-a4f5-4448-ae00-cb00a7bb43bb',
    secondaryImage: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolishremover%2Fnailpolremover.jpeg?alt=media&token=16f127ff-a4f5-4448-ae00-cb00a7bb43bb',
    description: 'Gentle yet effective formula to remove polish without drying out cuticles. Infused with soothing agents for a premium experience.',
    rating: 4.5,
    reviews: 31,
    shades: [],
    images: ['https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolishremover%2Fnailpolremover.jpeg?alt=media&token=16f127ff-a4f5-4448-ae00-cb00a7bb43bb'],
    gallery: ['https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/NailPolishremover%2Fnailpolremover.jpeg?alt=media&token=16f127ff-a4f5-4448-ae00-cb00a7bb43bb'],
    videos: []
  },
  {
    id: 6,
    name: '4 ml Sindoor',
    tag: 'Traditional',
    category: 'sindoor',
    price: 149,
    image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Sindoor%2Fsindoorwithbox.jpeg?alt=media&token=701b995c-36af-48cb-8385-6d7edca28ddd',
    secondaryImage: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Sindoor%2Fsindoorstick.jpeg?alt=media&token=1f463d26-bbab-447f-a67f-d9443ef90adc',
    description: 'Premium rich red sindoor powder with a velvet-smooth texture. A perfect blend of tradition and modern luxury.',
    rating: 4.9,
    reviews: 42,
    shades: [],
    images: [
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Sindoor%2Fsindoorwithbox.jpeg?alt=media&token=701b995c-36af-48cb-8385-6d7edca28ddd',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Sindoor%2Fsindoorstick.jpeg?alt=media&token=1f463d26-bbab-447f-a67f-d9443ef90adc'
    ],
    gallery: [
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Sindoor%2Fsindoorwithbox.jpeg?alt=media&token=701b995c-36af-48cb-8385-6d7edca28ddd',
      'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/Sindoor%2Fsindoorstick.jpeg?alt=media&token=1f463d26-bbab-447f-a67f-d9443ef90adc'
    ],
    videos: []
  },
  {
    id: "balm-to-water",
    name: "Balm to Water",
    tag: "Face",
    category: "face",
    price: 349,
    image: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/BalmtoWater%2Fbalmtowater.jpeg?alt=media&token=8d4d1776-5b79-49a5-be7e-0018cb3c3179",
    secondaryImage: "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/BalmtoWater%2Fb2w.jpeg?alt=media&token=1c34efd4-c004-46ad-a90e-9fb159aaaa2c",
    images: [
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/BalmtoWater%2Fbalmtowater.jpeg?alt=media&token=8d4d1776-5b79-49a5-be7e-0018cb3c3179",
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/BalmtoWater%2Fb2w.jpeg?alt=media&token=1c34efd4-c004-46ad-a90e-9fb159aaaa2c"
    ],
    description: "Advanced balm-to-water formula powered by Niacinamide.",
    rating: 5.0,
    reviews: 0,
    shades: [],
    gallery: [
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/BalmtoWater%2Fbalmtowater.jpeg?alt=media&token=8d4d1776-5b79-49a5-be7e-0018cb3c3179",
      "https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/BalmtoWater%2Fb2w.jpeg?alt=media&token=1c34efd4-c004-46ad-a90e-9fb159aaaa2c"
    ],
    videos: [],
    status: "Live",
    isBestSeller: true
  }
];

export default products;
