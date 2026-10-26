// from https://github.com/jonschlinkert/is-windows MIT Licensed
// inlined to keep this module dependency-free

export default function isWindows () {
  return process && (process.platform === 'win32' || /^(msys|cygwin)$/.test(process.env.OSTYPE ?? ''))
}
