import { supabaseAdmin } from '../src/api/supabaseAdmin.js'

const action = process.argv[2]
const table = process.argv[3]
const payload = process.argv[4] ? JSON.parse(process.argv[4]) : {}

async function run() {
  try {
    if (action === 'select') {
      const { data, error } = await supabaseAdmin.from(table).select(payload.query || '*')
      if (error) throw error
      console.log(JSON.stringify(data, null, 2))
    } else if (action === 'insert') {
      const { data, error } = await supabaseAdmin.from(table).insert(payload.data).select()
      if (error) throw error
      console.log(JSON.stringify(data, null, 2))
    } else if (action === 'update') {
      const { data, error } = await supabaseAdmin.from(table).update(payload.data).eq(payload.column || 'id', payload.value).select()
      if (error) throw error
      console.log(JSON.stringify(data, null, 2))
    } else if (action === 'delete') {
      const { data, error } = await supabaseAdmin.from(table).delete().eq(payload.column || 'id', payload.value).select()
      if (error) throw error
      console.log(JSON.stringify(data, null, 2))
    } else if (action === 'rpc') {
      const { data, error } = await supabaseAdmin.rpc(payload.fn, payload.params || {})
      if (error) throw error
      console.log(JSON.stringify(data, null, 2))
    } else if (action === 'sql') {
      // Run raw SQL via rpc (requires a generic function on Supabase side, or use REST)
      console.error('Raw SQL requires a Supabase Edge Function or direct Postgres connection.')
      process.exit(1)
    } else {
      console.log(`Usage: node scripts/db-cli.js <action> <table> '<json-payload>'`)
      console.log(`Actions: select, insert, update, delete, rpc`)
      console.log(`Examples:`)
      console.log(`  node scripts/db-cli.js select profiles '{"query":"*"}'`)
      console.log(`  node scripts/db-cli.js insert clients '{"data":{"name":"Acme"}}'`)
      console.log(`  node scripts/db-cli.js update clients '{"data":{"name":"New Name"},"value":"uuid-here"}'`)
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

run()
