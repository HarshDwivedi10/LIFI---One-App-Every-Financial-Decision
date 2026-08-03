const fs = require('fs');
const path = require('path');

function removeEmojis(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeEmojis(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace buttons explicitly so they don't become empty
      content = content.replace(/>✏️</g, '>Edit<');
      content = content.replace(/>✓</g, '>Save<');
      content = content.replace(/>✨</g, '><');
      content = content.replace(/>🚀</g, '><');
      
      // Replace emoji strings with nothing or empty
      const emojiRegex = /[❌⚠️🎉✏️✓🚀✨]/g;
      if (emojiRegex.test(content)) {
        content = content.replace(emojiRegex, '');
        fs.writeFileSync(fullPath, content);
        console.log('Removed emojis from', fullPath);
      }
    }
  }
}

removeEmojis(path.join(__dirname, 'frontend/src'));
