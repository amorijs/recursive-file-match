/**
 * This module exports a function which recursively searches a directory and
 * all sub-directories contained within it, building a list of files that match
 * the given match and extension.
 */

const fs = require('fs');
const path = require('path');

const promisify = require('es6-promisify');
const throttleAndQueue = require('throque');

// Create promisified versions of callback style methods
const [readFilePromise, readdirPromise, statPromise] = [
  fs.readFile,
  fs.readdir,
  fs.stat
].map(func => promisify(func));

// Create a throttled version of readFilePromise to limit active number of calls
const throttledReadFilePromise = throttleAndQueue(fs.readFile, 200, false);

/**
 * Asynchronously tests whether or not the given path is a directory.
 * @param {string} path - File system path to test if it is a directory.
 * @returns {promise} Resolves with a  boolean indicating whether or not path is
 *  a directory.
 */
const isDirectory = async function(path) {
  const stats = await statPromise(path);
  return stats.isDirectory();
};

/**
 * Asynchronously tests whether or not not the given file path matches the given
 * match and extension.
 * @param {string} filePath - Path of file to test for match.
 * @param {string|RegExp} match - Match to test for in contents of each file. If
 *  a string is provided, it will be converted to a regular expression without
 *  any flags.
 * @param {string} extension - File extension to assert against filePath.
 * @returns {promise} Resolves with a boolean indicating whether or not the file
 *  is a match.
 */
const doesFileMatch = async function(filePath, match, extension) {
  if (extension) {
    const extensionDoesMatch = path.extname(filePath) === extension;
    if (!extensionDoesMatch) return false;
  }

  const regex = typeof match === 'string' ? new RegExp(match) : match;

  const fileContents = await throttledReadFilePromise(filePath, {
    encoding: 'utf8'
  });

  return regex.test(fileContents);
};

/**
 * Asynchronously tests each item in an array of file paths against a given
 * match and extension.
 * @param {array<string>} filePaths - Array of file system paths to test for
 *  matches.
 * @param {string|RegExp} match - Match to test for in contents of each file.
 * @param {string} extension - Extension of files to test for matches.
 * @returns {promise} Resolves with an array of file paths which tested
 *  positively for the given match.
 */
const singleDirectoryFileMatch = async function(filePaths, match, extension) {
  const matchPromises = filePaths.map(async path => {
    const fileDoesMatch = await doesFileMatch(path, match, extension);
    if (fileDoesMatch) return path;
  });

  const matches = await Promise.all(matchPromises);
  return matches.filter(element => element !== undefined);
};

/**
 * @callback directoryCallback
 *  @param {array<string>} filePaths - Array of all paths of files or
 *   directories found inside a directory.
 *
 * Asychronously traverses through the root directory and all sub-directories
 * contained within it, invoking directoryCallback for each directory.
 * Will resolve only after directoryCallback has been invoked on all
 * sub-directories. Furthermore, if the directoryCallback provided returns a
 * promise, traverseDirectory will only resolve if all invocations of
 * directoryCallback resolved, and will reject if any invocations of
 * directoryCallback rejected.
 * @param {string} rootDir - Root directory to begin recursively traversing.
 * @param {directoryCallback} callback - Function to invoke for root directory
 *  and all of its' sub-directories.
 * @returns {promise} Resolves with the return value of directoryCallback.
 */
const traverseDirectoryTree = async function(rootDir, directoryCallback) {
  const pathIsDirectory = await isDirectory(rootDir);
  if (!pathIsDirectory) return;

  const directoryItems = await readdirPromise(rootDir);
  const filePaths = directoryItems.map(item => path.join(rootDir, item));
  const callbackReturn = directoryCallback(filePaths);

  const directoryPromises = filePaths.map(path =>
    traverseDirectoryTree(path, directoryCallback)
  );

  const directoriesComplete = Promise.all(directoryPromises);
  const allComplete = Promise.all([callbackReturn, directoriesComplete]);
  return allComplete;
};

/**
 * Asynchronously searches a directory and all sub-directories for any files
 * that match the given match input.
 * @param {string} rootDir - Root directory to begin searching for file matches.
 * @param {string|RegExp} match - Match to test for in contents of each file.
 * @param {string} extension - Extension of files to test for matches.
 * @returns {promise} Resolves with an array of file paths which tested
 *  positively for the given match.
 */
const recursiveFileMatch = async function(rootDir, match, extension) {
  const allFileMatches = [];

  const allDirsSearched = traverseDirectoryTree(rootDir, async filePaths => {
    const dirComplete = singleDirectoryFileMatch(filePaths, match, extension);
    const fileMatches = await dirComplete;
    allFileMatches.push(...fileMatches);
  });

  await allDirsSearched;
  return allFileMatches;
};

module.exports = recursiveFileMatch;