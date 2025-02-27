const url = require('url')
const npmConf = require('@pnpm/npm-conf')

const tokenKey = ':_authToken'
const legacyTokenKey = ':_auth'
const userKey = ':username'
const passwordKey = ':_password'

module.exports = function getRegistryAuthToken () {
  let checkUrl
  let options
  if (arguments.length >= 2) {
    checkUrl = arguments[0]
    options = Object.assign({}, arguments[1])
  } else if (typeof arguments[0] === 'string') {
    checkUrl = arguments[0]
  } else {
    options = Object.assign({}, arguments[0])
  }
  options = options || {}
  options.npmrc = options.npmrc ? {
    ...options.npmrc,
    get: (key) => options.npmrc[key]
  } : npmConf()
  checkUrl = checkUrl || options.npmrc.get('registry') || npmConf.defaults.registry
  return getRegistryAuthInfo(checkUrl, options) || getLegacyAuthInfo(options.npmrc)
}

function getRegistryAuthInfo (checkUrl, options) {
  const parsed = url.parse(checkUrl, false, true)
  let pathname

  while (pathname !== '/' && parsed.pathname !== pathname) {
    pathname = parsed.pathname || '/'

    const regUrl = '//' + parsed.host + pathname.replace(/\/$/, '')
    const authInfo = getAuthInfoForUrl(regUrl, options.npmrc)
    if (authInfo) {
      return authInfo
    }

    // break if not recursive
    if (!options.recursive) {
      return /\/$/.test(checkUrl)
        ? undefined
        : getRegistryAuthInfo(url.resolve(checkUrl, '.'), options)
    }

    parsed.pathname = url.resolve(normalizePath(pathname), '..') || '/'
  }

  return undefined
}

function getLegacyAuthInfo (npmrc) {
  if (!npmrc.get('_auth')) {
    return undefined
  }

  const token = replaceEnvironmentVariable(npmrc.get('_auth'))

  return { token: token, type: 'Basic' }
}

function normalizePath (path) {
  return path[path.length - 1] === '/' ? path : path + '/'
}

function getAuthInfoForUrl (regUrl, npmrc) {
  // try to get bearer token
  const bearerAuth = getBearerToken(npmrc.get(regUrl + tokenKey) || npmrc.get(regUrl + '/' + tokenKey))
  if (bearerAuth) {
    return bearerAuth
  }

  // try to get basic token
  const username = npmrc.get(regUrl + userKey) || npmrc.get(regUrl + '/' + userKey)
  const password = npmrc.get(regUrl + passwordKey) || npmrc.get(regUrl + '/' + passwordKey)
  const basicAuth = getTokenForUsernameAndPassword(username, password)
  if (basicAuth) {
    return basicAuth
  }

  const basicAuthWithToken = getLegacyAuthToken(npmrc.get(regUrl + legacyTokenKey) || npmrc.get(regUrl + '/' + legacyTokenKey))
  if (basicAuthWithToken) {
    return basicAuthWithToken
  }

  return undefined
}

function replaceEnvironmentVariable (token) {
  return token.replace(/^\$\{?([^}]*)\}?$/, function (fullMatch, envVar) {
    return process.env[envVar]
  })
}

function getBearerToken (tok) {
  if (!tok) {
    return undefined
  }

  // check if bearer token is set as environment variable
  const token = replaceEnvironmentVariable(tok)

  return { token: token, type: 'Bearer' }
}

function getTokenForUsernameAndPassword (username, password) {
  if (!username || !password) {
    return undefined
  }

  // passwords are base64 encoded, so we need to decode it
  // See https://github.com/npm/npm/blob/v3.10.6/lib/config/set-credentials-by-uri.js#L26
  const pass = Buffer.from(replaceEnvironmentVariable(password), 'base64').toString('utf8')

  // a basic auth token is base64 encoded 'username:password'
  // See https://github.com/npm/npm/blob/v3.10.6/lib/config/get-credentials-by-uri.js#L70
  const token = Buffer.from(username + ':' + pass, 'utf8').toString('base64')

  // we found a basicToken token so let's exit the loop
  return {
    token: token,
    type: 'Basic',
    password: pass,
    username: username
  }
}

function getLegacyAuthToken (tok) {
  if (!tok) {
    return undefined
  }

  // check if legacy auth token is set as environment variable
  const token = replaceEnvironmentVariable(tok)

  return { token: token, type: 'Basic' }
}
