/**
 * Script which recursively builds a list of file matches and prints this list
 * to a file.
 */

const START_TIME = Date.now();

const fs = require('fs');
const path = require('path');
const recursiveFileMatch = require('./recursiveFileMatch');

// ** MODIFY THIS SECTION TO CUSTOMIZE **
// Where to begin recursively searching
const rootDir = path.join(__dirname);
// What to test for in each file - can be string or regex
const match = 'match to find';
// Test only files with this extension - undefined will read and test all files
const extension = '.html';
// Where to write list of file names to
const writeFilePath = path.join(__dirname, 'file_list.json');
// **************************************

recursiveFileMatch(rootDir, match, extension)
  .then(matches => matches.sort())
  .then(sortedMatches => JSON.stringify(sortedMatches, null, 2))
  .then(prettifiedMatches => fs.writeFileSync(writeFilePath, prettifiedMatches))
  .then(() => {
    const END_TIME = Date.now() - START_TIME;
    const seconds = Math.ceil(END_TIME / 1000);
    console.log(`Finished in approximately ${seconds} seconds`);
  })
  .catch(console.log);
