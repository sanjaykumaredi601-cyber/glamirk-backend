import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const generateTestZip = () => {
  const zip = new AdmZip();
  const folderPath = 'TestCosmetics';

  // Valid 1x1 JPEG base64 to buffer so sharp doesn't throw invalid format
  const validImageBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAGBAQABAAQAAAAAA//QAAMAAQAAQQAAAAAAAAAAAAAAAAAA/9sAQwD//////////////////////////////////////////////////////////////////////////////////////8IACwgAAQABAQERAP/EABQQAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABAAQAAAAAA//QAAMAAQAAQQAAAAAAAAAAAAAAAAAA/9k=', 'base64');

  // Generate 50 folders
  for (let i = 1; i <= 50; i++) {
    const shadeFolder = `${folderPath}/${i}`;
    
    // Valid images
    zip.addFile(`${shadeFolder}/image1.jpg`, validImageBuffer);
    zip.addFile(`${shadeFolder}/image2.jpg`, validImageBuffer);
    zip.addFile(`${shadeFolder}/image3.jpg`, validImageBuffer);

    // Invalid/corrupted/hidden files
    zip.addFile(`${shadeFolder}/.DS_Store`, Buffer.from('mac os junk'));
    zip.addFile(`${shadeFolder}/corrupted.txt`, Buffer.from('not an image'));
    zip.addFile(`${shadeFolder}/__MACOSX/._image1.jpg`, Buffer.from('mac os hidden junk'));
  }

  // Duplicate upload test
  zip.addFile(`${folderPath}/1/duplicate.jpg`, validImageBuffer);

  const outputPath = path.resolve('test_shades_50.zip');
  zip.writeZip(outputPath);
  console.log(`Test ZIP created with 50 folders at ${outputPath}`);
};

generateTestZip();
