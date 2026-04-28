const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/iamja/Desktop/Alphahive/HealthPowr/src';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Button Consistencies Component-Wide (Primary buttons)
  content = content.replace(
    /className="([^"]*bg-emerald-600 text-white[^"]*px-4 py-2[^"]*)"/g,
    'className="flex items-center justify-center gap-[8px] bg-teal-600 text-white px-[18px] py-[9px] rounded-lg font-medium text-[14px] hover:bg-teal-700 transition-all duration-200 cursor-pointer flex-shrink-0"'
  );

  // Ghost buttons/secondary
  content = content.replace(
    /className="([^"]*px-4 py-2[^"]*border border-gray-300[^"]*)"/g,
    'className="flex items-center justify-center gap-[8px] bg-white text-gray-700 border border-gray-200 px-[18px] py-[9px] rounded-lg font-medium text-[14px] hover:bg-gray-50 transition-all duration-200 cursor-pointer flex-shrink-0"'
  );

  // Tab buttons
  content = content.replace(
    /className="([^"]*px-6 py-3 rounded-lg[^"]*)"/g,
    'className="flex items-center gap-2 px-4 py-2 rounded-full font-medium text-[14px] transition-all whitespace-nowrap"'
  );

  // emerald to teal
  content = content.replace(/emerald-600/g, 'teal-600');
  content = content.replace(/emerald-700/g, 'teal-700');
  content = content.replace(/emerald-100/g, 'teal-50');
  content = content.replace(/emerald-300/g, 'teal-200');
  content = content.replace(/emerald-500/g, 'teal-500');

  // Fix Avatars: find any div with `w-10 h-10 rounded-full` or `w-8 h-8 rounded-full`
  content = content.replace(
    /className="w-10 h-10([^"]*)rounded-full([^"]*)"/g,
    'className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex-shrink-0 $1$2"'
  );
  content = content.replace(
    /className="w-8 h-8([^"]*)rounded-full([^"]*)"/g,
    'className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full flex-shrink-0 $1$2"'
  );

  // Typography
  content = content.replace(/text-3xl font-bold/g, 'text-[24px] font-bold tracking-tight');
  content = content.replace(/text-xl font-bold/g, 'text-[16px] font-semibold leading-tight');
  content = content.replace(/text-lg font-semibold/g, 'text-[18px] font-semibold');

  // Card paddings and shadows
  content = content.replace(
    /className="([^"]*)bg-white rounded-lg shadow-sm border border-gray-200 p-6([^"]*)"/g,
    'className="$1bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-200 p-5$2"'
  );
  content = content.replace(
    /className="([^"]*)bg-white rounded-lg shadow-sm border border-gray-200([^"]*)"/g,
    'className="$1bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-200$2"'
  );

  // Fix Tables globally
  // Look for <table className="w-full"> and ensure it's wrapped.
  // Actually regex for HTML structure is tricky, but let's just make the tables min-width
  content = content.replace(/<table className="w-full">/g, '<table className="w-full border-collapse min-w-[800px]">');
  content = content.replace(/<th className="([^"]*)"/g, (match, classes) => {
    if (classes.includes('text-left py-3 px-6')) {
       return `<th className="px-4 py-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200 whitespace-nowrap"`;
    }
    return match;
  });
  content = content.replace(/<td className="([^"]*)"/g, (match, classes) => {
    if (classes.includes('py-4 px-6')) {
       return `<td className="p-4 text-[14px] text-gray-900 border-b border-gray-100 align-top"`;
    }
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

processDirectory(srcDir);
console.log('Done!');
