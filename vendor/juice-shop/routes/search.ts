/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import path from 'node:path'
import { type Request, type Response, type NextFunction } from 'express'

import * as utils from '../lib/utils'
import * as models from '../models/index'
import { UserModel } from '../models/user'
import { challenges } from '../data/datacache'
import * as challengeUtils from '../lib/challengeUtils'

class ErrorWithParent extends Error {
  parent: Error | undefined
}

// The injectable search query runs on its own SQLite connection opened with
// OPEN_READONLY + PRAGMA query_only, so no payload can write to the database.
const sqlite3: any = require('sqlite3')
let readOnlyDb: any = null

function databaseFile (): string {
  const storage = String((models.sequelize as any)?.options?.storage ?? 'data/juiceshop.sqlite')
  return path.isAbsolute(storage) ? storage : path.resolve(storage)
}

function openReadOnlyDb (): Promise<any> {
  if (readOnlyDb) {
    return Promise.resolve(readOnlyDb)
  }
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databaseFile(), sqlite3.OPEN_READONLY, (err: Error | null) => {
      if (err) {
        reject(err)
        return
      }
      db.run('PRAGMA query_only = ON', (pragmaError: Error | null) => {
        if (pragmaError) {
          reject(pragmaError)
          return
        }
        readOnlyDb = db
        resolve(db)
      })
    })
  })
}

function queryReadOnly (sql: string): Promise<any[]> {
  return openReadOnlyDb().then((db) => new Promise<any[]>((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: any[]) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
  }))
}

// vuln-code-snippet start unionSqlInjectionChallenge dbSchemaChallenge
export function searchProducts () {
  return (req: Request, res: Response, next: NextFunction) => {
    let criteria: any = req.query.q === 'undefined' ? '' : req.query.q ?? ''
    criteria = (criteria.length <= 200) ? criteria : criteria.substring(0, 200)
    queryReadOnly(`SELECT * FROM Products WHERE ((name LIKE '%${criteria}%' OR description LIKE '%${criteria}%') AND deletedAt IS NULL) ORDER BY name`) // vuln-code-snippet vuln-line unionSqlInjectionChallenge dbSchemaChallenge
      .then((products: any) => {
        const dataString = JSON.stringify(products)
        if (challengeUtils.notSolved(challenges.unionSqlInjectionChallenge)) { // vuln-code-snippet hide-start
          let solved = true
          UserModel.findAll().then(data => {
            const users = utils.queryResultToJson(data)
            if (users.data?.length) {
              for (let i = 0; i < users.data.length; i++) {
                solved = solved && utils.containsOrEscaped(dataString, users.data[i].email) && dataString.includes(users.data[i].password)
                if (!solved) {
                  break
                }
              }
              if (solved) {
                challengeUtils.solve(challenges.unionSqlInjectionChallenge)
              }
            }
          }).catch((error: Error) => {
            next(error)
          })
        }
        if (challengeUtils.notSolved(challenges.dbSchemaChallenge)) {
          let solved = true
          void models.sequelize.query('SELECT sql FROM sqlite_master').then(([data]: any) => {
            const tableDefinitions = utils.queryResultToJson(data)
            if (tableDefinitions.data?.length) {
              for (let i = 0; i < tableDefinitions.data.length; i++) {
                if (tableDefinitions.data[i].sql) {
                  solved = solved && utils.containsOrEscaped(dataString, tableDefinitions.data[i].sql)
                  if (!solved) {
                    break
                  }
                }
              }
              if (solved) {
                challengeUtils.solve(challenges.dbSchemaChallenge)
              }
            }
          })
        } // vuln-code-snippet hide-end
        for (let i = 0; i < products.length; i++) {
          products[i].name = req.__(products[i].name)
          products[i].description = req.__(products[i].description)
          if (typeof products[i].alternateImages === 'string') {
            products[i].alternateImages = JSON.parse(products[i].alternateImages)
          }
        }
        res.json(utils.queryResultToJson(products))
      }).catch((error: ErrorWithParent) => {
        next(error.parent ?? error)
      })
  }
}
// vuln-code-snippet end unionSqlInjectionChallenge dbSchemaChallenge
