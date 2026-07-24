const fs = require('fs');

let file = fs.readFileSync('src/components/PublicCoursePage.tsx', 'utf8');

// Add typo-title to all h1, h2, h3, h4, h5, h6
file = file.replace(/<(h[1-6])(.*?)className="([^"]+)"/g, '<$1$2className="$3 typo-title"');

// Add typo-btn to all elements with bg-primary that are buttons or links (heuristic: contains py-, px-, bg-primary)
file = file.replace(/<([^>]+)className="([^"]*bg-primary[^"]*text-white[^"]*px-[^"]*)"/g, '<$1className="$2 typo-btn"');

// Add typo-link to Nav links. Let's find Nav links: text-slate-600 hover:text-slate-900, etc.
// Not easy, but let's add typo-link to header nav elements and footer links.

// We need to inject the CSS block too. Let's inject it into both <style> blocks.
const typoCss = `
          /* Typography overrides */
          ${"$"}{lp.font_title_color ? \`.typo-title { color: \${lp.font_title_color} !important; }\` : ''}
          ${"$"}{lp.font_title_weight ? \`.typo-title { font-weight: \${lp.font_title_weight} !important; }\` : ''}
          ${"$"}{lp.font_subtitle_color ? \`.typo-subtitle { color: \${lp.font_subtitle_color} !important; }\` : ''}
          ${"$"}{lp.font_subtitle_weight ? \`.typo-subtitle { font-weight: \${lp.font_subtitle_weight} !important; }\` : ''}
          ${"$"}{lp.font_text_color ? \`.typo-text { color: \${lp.font_text_color} !important; }\` : ''}
          ${"$"}{lp.font_text_weight ? \`.typo-text { font-weight: \${lp.font_text_weight} !important; }\` : ''}
          ${"$"}{lp.font_button_color ? \`.typo-btn { color: \${lp.font_button_color} !important; }\` : ''}
          ${"$"}{lp.font_button_weight ? \`.typo-btn { font-weight: \${lp.font_button_weight} !important; }\` : ''}
          ${"$"}{lp.font_link_color ? \`.typo-link { color: \${lp.font_link_color} !important; }\` : ''}
          ${"$"}{lp.font_link_weight ? \`.typo-link { font-weight: \${lp.font_link_weight} !important; }\` : ''}
`;

// Inject into style blocks
file = file.replace(/(\.selection\\:text-white ::selection \{ color: white; \})/g, `$1\n${typoCss}`);

fs.writeFileSync('src/components/PublicCoursePage.tsx', file);
console.log('Classes added');
