import fetch from 'node-fetch';

async function testApis() {
  console.log('Testing /api/cms...');
  try {
    const resCms = await fetch('http://localhost:5000/api/cms');
    const dataCms = await resCms.json();
    console.log('CMS Success:', dataCms.success);
    console.log('Homepage Keys:', dataCms.homepage ? Object.keys(dataCms.homepage) : 'null');
  } catch (err) {
    console.error('CMS Fetch Error:', err.message);
  }

  console.log('\nTesting /api/products...');
  try {
    const resProd = await fetch('http://localhost:5000/api/products');
    const dataProd = await resProd.json();
    console.log('Products Success:', dataProd.success);
    console.log('Products Count:', dataProd.products ? dataProd.products.length : 'null');
  } catch (err) {
    console.error('Products Fetch Error:', err.message);
  }
}

testApis();
