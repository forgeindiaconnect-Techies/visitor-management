const fs = require('fs');
const path = require('path');

const desktopPath = 'C:\\Users\\Forgeindiaconnect\\Desktop';
const destPath = path.join(__dirname, 'public', 'vms-demo.mp4');

try {
  const files = fs.readdirSync(desktopPath);
  console.log('Desktop files:', files);

  const targetFolder = files.find(f => f.toLowerCase().includes('visiotrs management') || f.toLowerCase().includes('visitor'));
  if (targetFolder) {
    const folderPath = path.join(desktopPath, targetFolder);
    const subFiles = fs.readdirSync(folderPath);
    console.log('Subfiles in folder:', subFiles);

    const videoFile = subFiles.find(sf => sf.endsWith('.mp4') || sf.endsWith('.webm') || sf.endsWith('.mov') || sf.endsWith('.avi'));
    if (videoFile) {
      const fullVideoPath = path.join(folderPath, videoFile);
      fs.copyFileSync(fullVideoPath, destPath);
      console.log('SUCCESSFULLY COPIED VIDEO TO:', destPath);
    } else {
      console.log('No mp4/video file found in folder:', folderPath);
    }
  } else {
    // Check if mp4 is directly on Desktop
    const directVideo = files.find(f => f.endsWith('.mp4') || f.endsWith('.webm'));
    if (directVideo) {
      fs.copyFileSync(path.join(desktopPath, directVideo), destPath);
      console.log('SUCCESSFULLY COPIED DIRECT VIDEO TO:', destPath);
    } else {
      console.log('Target folder not found on Desktop.');
    }
  }
} catch (err) {
  console.error('Error finding/copying video:', err);
}
