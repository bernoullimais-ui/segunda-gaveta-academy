const fs = require('fs');

let file = fs.readFileSync('src/components/PublicCoursePage.tsx', 'utf8');

// Add typo-subtitle to hero subtitles:
// They are usually p tags with text-lg or text-xl under the hero h1
file = file.replace(/<p className="text-xl text-slate-[0-9]+([^"]*)"/g, '<p className="text-xl text-slate-700$1 typo-subtitle"');

// Add typo-text to standard p tags
file = file.replace(/<p className="text-slate-[0-9]+([^"]*)"/g, '<p className="text-slate-700$1 typo-text"');
file = file.replace(/<p className="text-sm text-slate-[0-9]+([^"]*)"/g, '<p className="text-sm text-slate-700$1 typo-text"');
file = file.replace(/<p className="text-base text-slate-[0-9]+([^"]*)"/g, '<p className="text-base text-slate-700$1 typo-text"');

// Nav links: text-slate-600 hover:text-slate-900, etc.
file = file.replace(/className="text-sm font-bold text-slate-[0-9]+([^"]*)"/g, 'className="text-sm font-bold text-slate-700$1 typo-link"');

fs.writeFileSync('src/components/PublicCoursePage.tsx', file);
console.log('Classes refined');
