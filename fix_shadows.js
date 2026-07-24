const fs = require('fs');
let file = fs.readFileSync('src/components/PublicCoursePage.tsx', 'utf8');
file = file.replace(/rgba\(37,99,235/g, 'rgba(var(--primary-rgb)');
fs.writeFileSync('src/components/PublicCoursePage.tsx', file);
console.log('Replaced shadows.');
