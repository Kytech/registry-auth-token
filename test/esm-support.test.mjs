import fs from 'node:fs'
import assert from 'node:assert'
import { URL, fileURLToPath } from 'node:url'

import { describe, it, afterEach } from 'mocha'

import getAuthToken from '../index.js'

const npmRcPath = fileURLToPath(new URL('../.npmrc', import.meta.url))

describe('ESM Support', function () {
  afterEach(function (done) {
    fs.unlink(npmRcPath, function () {
      done()
    })
  })

  it('should be running this test in an ESM context without require.resolve', function () {
    assert.strictEqual(global.require, undefined)
    assert.strictEqual(global.require?.resolve, undefined)
  })

  describe('bearer token', function () {
    it('should return auth token if registry is defined', function (done) {
      const content = [
        'registry=http://registry.foobar.eu/',
        '//registry.foobar.eu/:_authToken=foobar', ''
      ].join('\n')

      fs.writeFile(npmRcPath, content, function (err) {
        assert(!err, err)
        assert.deepStrictEqual(getAuthToken(), { token: 'foobar', type: 'Bearer' })
        done()
      })
    })
  })
})