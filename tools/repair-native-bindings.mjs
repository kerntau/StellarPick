import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

// npm lockfiles generated on one OS often omit the optional native packages
// for other platforms (npm/cli#4828). After `npm ci`, fetch the matching
// platform packages directly with `npm pack` + tar, so npm's tree solver does
// not need to reconcile an incomplete lockfile.
const npm = process.argv[2] || 'npm'
const platform = process.platform
const arch = process.arch

let isMusl = false
if (platform === 'linux') {
  try {
    isMusl = !process.report?.getReport?.()?.header?.glibcVersionRuntime
  } catch {
    isMusl = false
  }
}

const variants = platform === 'linux'
  ? (isMusl
      ? [`linux-${arch}-musl`, `linux-${arch}`]
      : [`linux-${arch}-gnu`, `linux-${arch}-glibc`, `linux-${arch}`])
  : [`${platform}-${arch}`]

function pickOptionalKey (optionalDependencies) {
  for (const variant of variants) {
    const key = Object.keys(optionalDependencies).find((name) => name.includes(variant))
    if (key) return key
  }
  return null
}

function packageDirs () {
  const root = 'node_modules'
  const dirs = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    if (entry.name.startsWith('@')) {
      const scope = join(root, entry.name)
      for (const sub of readdirSync(scope, { withFileTypes: true })) {
        if (sub.isDirectory()) dirs.push(join(scope, sub.name))
      }
    } else {
      dirs.push(join(root, entry.name))
    }
  }
  return dirs
}

function hasPackage (dir) {
  try {
    return existsSync(dir) && readdirSync(dir).length > 0
  } catch {
    return false
  }
}

const missing = new Map()
for (const dir of packageDirs()) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    continue
  }
  if (!pkg.optionalDependencies) continue
  const key = pickOptionalKey(pkg.optionalDependencies)
  if (!key) continue
  const target = join('node_modules', ...key.split('/'))
  if (!hasPackage(target)) {
    missing.set(key, pkg.optionalDependencies[key])
  }
}

if (missing.size === 0) {
  console.log(`native optional packages OK (${platform}-${arch})`)
  process.exit(0)
}

console.log(`installing native optional packages for ${platform}-${arch}:`)
for (const [name, version] of missing) console.log(`  ${name}@${version}`)

const work = mkdtempSync(join(tmpdir(), 'stellarpick-native-'))
try {
  for (const [name, version] of missing) {
    const spec = `${name}@${version}`
    const packed = spawnSync(npm, ['pack', spec, '--pack-destination', work, '--json'], {
      encoding: 'utf8',
      shell: platform === 'win32'
    })
    if (packed.error || packed.status !== 0) {
      console.error(`npm pack failed for ${spec}`)
      if (packed.error) console.error(packed.error)
      if (packed.stderr) console.error(packed.stderr)
      process.exit(1)
    }
    let info
    try {
      info = JSON.parse(packed.stdout)[0]
    } catch {
      console.error(`could not parse npm pack output for ${spec}`)
      console.error(packed.stdout)
      process.exit(1)
    }
    const tarball = join(work, info.filename)
    const target = join('node_modules', ...name.split('/'))
    mkdirSync(target, { recursive: true })
    const tarArgs = ['-xzf', tarball, '-C', target, '--strip-components=1']
    if (platform === 'win32') tarArgs.unshift('--force-local')
    const extracted = spawnSync('tar', tarArgs, {
      stdio: 'inherit'
    })
    if (extracted.error || extracted.status !== 0) {
      console.error(`tar extraction failed for ${spec}`)
      if (extracted.error) console.error(extracted.error)
      rmSync(target, { recursive: true, force: true })
      process.exit(1)
    }
    console.log(`  installed ${spec}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
