// from https://github.com/sindresorhus/is-heroku/tree/main MIT Licensed
// inlined to keep this module dependency-free

export default () => 'HEROKU' in process.env || ('DYNO' in process.env && process.env.HOME === '/app')
