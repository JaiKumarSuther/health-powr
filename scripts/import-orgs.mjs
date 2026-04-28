import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function geocode(address, borough) {
  const q = encodeURIComponent(`${address}, ${borough}, New York City, NY`)
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}&viewbox=-74.259090,40.477399,-73.700272,40.917577&bounded=1&countrycodes=us`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HealthPowr/1.0' } })
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return { lat: null, lng: null }
}

function parseBorough(s) {
  if (!s) return 'Brooklyn'
  const b = s.toLowerCase()
  if (b.includes('manhattan')) return 'Manhattan'
  if (b.includes('brooklyn')) return 'Brooklyn'
  if (b.includes('queens')) return 'Queens'
  if (b.includes('bronx')) return 'Bronx'
  if (b.includes('staten')) return 'Staten Island'
  return 'Brooklyn'
}

function parsePhone(s) {
  if (!s) return null
  const m = s.match(/\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/)
  return m ? m[0].replace(/\D/g, '').slice(0, 10) : null
}

function parseWebsite(s) {
  if (!s) return null
  const m = s.match(/https?:\/\/[^\s,]+|[a-z0-9\-]+\.[a-z]{2,}(?:\/[^\s,]*)?/i)
  if (!m) return null
  return m[0].startsWith('http') ? m[0] : `https://${m[0]}`
}

function parseEmail(s) {
  if (!s) return null
  const m = s.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return m ? m[0] : null
}

function parseLangs(s) {
  if (!s) return ['en']
  const map = { english:'en', spanish:'es', french:'fr', creole:'ht',
    'haitian creole':'ht', arabic:'ar', chinese:'zh', cantonese:'zh',
    mandarin:'zh', russian:'ru', hebrew:'he', yiddish:'yi', bengali:'bn',
    urdu:'ur', hindi:'hi', punjabi:'pa', polish:'pl', greek:'el' }
  const codes = s.split(/[,\/]/).map(l => map[l.trim().toLowerCase()] || 'en')
    .filter((v,i,a) => a.indexOf(v) === i)
  if (!codes.includes('en')) codes.unshift('en')
  return codes
}

const orgs = [
  // FOOD
  { name:'Met Council', address:'77 Water St', borough:'Manhattan (FiDi)', desc:'Largest Jewish communal safety net. Kosher food network and emergency pantry.', contact:'metcouncil.org / (212) 453-9511 / acyperstein@metcouncil.org', hours:'Mon–Fri: 9AM–5PM', langs:'Hebrew, Yiddish, Russian', cat:'food' },
  { name:'ACTS Community Dev Corp', address:'3012 Mermaid Ave, Brooklyn', borough:'Brooklyn (Coney Island)', desc:'Emergency food packages and outreach to families in Coney Island.', contact:'(718) 415-1170 / Coneylighthouse@aol.com', hours:'Call for distribution times', langs:'English', cat:'food' },
  { name:'Apna Brooklyn Community Center', address:'Brighton Beach Ave, Brooklyn', borough:'Brooklyn (Brighton Beach)', desc:'Community-led pantry serving immigrant families with culturally appropriate groceries.', contact:'(718) 513-4700 / erum.hanif@apnabrooklyn.com', hours:'Fri: 10AM–2PM', langs:'Bengali, Urdu, Arabic', cat:'food' },
  { name:'Masbia of Flatbush', address:'1372 Coney Island Ave, Brooklyn', borough:'Brooklyn (Flatbush)', desc:'Soup kitchen and pantry with appointment-based service for dignity.', contact:'masbia.org / (718) 972-4446', hours:'Mon–Thu: 11AM–7PM', langs:'Hebrew, Yiddish', cat:'food' },
  { name:'St. John\'s Bread and Life', address:'795 Lexington Ave, Brooklyn', borough:'Brooklyn (Bed-Stuy)', desc:'Digital Choice pantry and mobile soup kitchen serving 2500+ meals daily.', contact:'breadandlife.org / (718) 574-0058', hours:'Mon–Fri: 8AM–12PM', langs:'Spanish', cat:'food' },
  { name:'The Campaign Against Hunger', address:'2010 Fulton St, Brooklyn', borough:'Brooklyn (Bed-Stuy)', desc:"One of NYC's largest food distributors using a Supermarket model.", contact:'tcahnyc.org / (718) 773-3551', hours:'Mon–Fri: 10AM–3PM', langs:'Spanish, Creole', cat:'food' },
  { name:'CHiPS Food Pantry', address:'25 4th Ave, Brooklyn', borough:'Brooklyn (Park Slope)', desc:'Soup kitchen and food pantry with a no questions asked dignity model.', contact:'chipsonline.org / (718) 237-2962', hours:'Mon–Sat: 11:30AM–1PM', langs:'Spanish', cat:'food' },
  { name:'Collective Focus Resource Hub', address:'Bushwick Ave, Brooklyn', borough:'Brooklyn (Bushwick)', desc:'Mutual aid hub with community fridge and Free Store for groceries.', contact:'collectivefocus.site / info@collectivefocus.site', hours:'Daily: 12PM–6PM', langs:'Spanish', cat:'food' },
  { name:'Reaching Out Community Services', address:'Bensonhurst, Brooklyn', borough:'Brooklyn (Bensonhurst)', desc:'Digital Pantry where clients use a keycard to select their own groceries.', contact:'rcsprograms.org / (718) 373-4565', hours:'Mon–Fri: 10AM–4PM', langs:'Spanish, Cantonese', cat:'food' },
  { name:'Sacred Center for South Asians', address:'Flushing, Queens', borough:'Queens (Flushing)', desc:'Food pantry meeting the dietary needs of South Asian New Yorkers.', contact:'sacssny.org / (718) 321-7929', hours:'Wed: 10AM–2PM', langs:'Hindi, Urdu, Punjabi', cat:'food' },
  { name:'Elmcor Youth & Adult Activities', address:'Corona Ave, Queens', borough:'Queens (Corona)', desc:'Longstanding community pantry providing bags and hot senior meals.', contact:'elmcor.org / (718) 651-0096', hours:'Tue/Thu: 10AM–12:30PM', langs:'Spanish', cat:'food' },
  { name:'Commonpoint Queens', address:'108-25 Queens Blvd, Queens', borough:'Queens (Forest Hills)', desc:'Client-choice digital grocery ordering. Emergency food packages available.', contact:'commonpoint.org / (718) 268-5011', hours:'Mon–Wed: 9AM–6:30PM; Sun: 10AM–2PM', langs:'Spanish, Russian', cat:'food' },
  { name:'Community Kitchen Food Bank NYC', address:'W 125th St, Manhattan', borough:'Manhattan (Harlem)', desc:"Farmer's Market style distribution twice monthly plus daily hot meals.", contact:'foodbanknyc.org / (212) 566-7855', hours:'Mon/Wed/Fri: 8AM–6PM', langs:'Spanish, French', cat:'food' },
  { name:'BronxWorks Food Pantry', address:'60 E Tremont Ave, Bronx', borough:'Bronx', desc:'Client-choice pantries by appointment. Distributed 33k+ bags in 2026.', contact:'bronxworks.org / (646) 596-1316', hours:'Call hotline for schedule', langs:'Spanish', cat:'food' },
  { name:'Project Hospitality Food Hub', address:'100 Central Ave, Staten Island', borough:'Staten Island (St. George)', desc:'One-stop hub for food, clothing, and social service enrollment.', contact:'projecthospitality.org / (718) 448-1544', hours:'Tue/Thu: 9AM–11AM', langs:'Spanish, Arabic', cat:'food' },
  // HOUSING
  { name:'The Door Covenant House', address:'555 Broome St, Manhattan', borough:'Manhattan (SoHo)', desc:'Crisis housing and residential programs for homeless youth ages 16-24.', contact:'door.org / (212) 941-9090', hours:'Mon–Fri: 9AM–5PM', langs:'Spanish', cat:'housing' },
  { name:'Ali Forney Center', address:'224 W 35th St, Manhattan', borough:'Manhattan', desc:'24-hour drop-in center and emergency beds for homeless LGBTQ+ youth.', contact:'aliforneycenter.org / (212) 206-0574', hours:'24/7', langs:'Spanish', cat:'housing' },
  { name:'Lenox Hill Neighborhood House', address:'331 E 70th St, Manhattan', borough:'Manhattan (UES)', desc:'100-bed shelter for women with mental health needs plus eviction legal help.', contact:'lenoxhill.org / (212) 744-5022', hours:'Mon–Fri: 9AM–5PM', langs:'Spanish', cat:'housing' },
  { name:'Nazareth Housing', address:'214 E 3rd St, Manhattan', borough:'Manhattan (LES)', desc:'Emergency shelter, eviction prevention grants, and housing stability support.', contact:'nazarethhousingnyc.org / (212) 777-1010', hours:'Mon–Fri: 9AM–5PM', langs:'Spanish', cat:'housing' },
  { name:'New Destiny Housing', address:'255 W 23rd St, Manhattan', borough:'Manhattan (Chelsea)', desc:'Permanent affordable housing exclusively for domestic violence survivors.', contact:'newdestinyhousing.org / (646) 472-0262', hours:'Mon–Fri: 9AM–5PM', langs:'Spanish', cat:'housing' },
  { name:'Covenant House New York', address:"460 W 41st St, Manhattan", borough:"Manhattan (Hell's Kitchen)", desc:'24/7 emergency intake for homeless youth with medical care and job training.', contact:'covenanthouse.org / (212) 613-0300', hours:'24/7', langs:'Spanish', cat:'housing' },
  { name:'Breaking Ground', address:'505 8th Ave, Manhattan', borough:'Manhattan', desc:'24/7 street outreach teams and Safe Haven transitional housing sites.', contact:'breakingground.org / (800) 548-1511', hours:'24/7 Outreach', langs:'Spanish', cat:'housing' },
  { name:'The Gathering Place CAMBA', address:'East New York, Brooklyn', borough:'Brooklyn (East NY)', desc:'Drop-in center with hot meals, clothing, and housing placement services.', contact:'camba.org / (718) 240-6444', hours:'Mon–Fri: 9AM–5PM', langs:'Spanish, Creole', cat:'housing' },
  { name:'BRC Living Room Bronx', address:'Hunts Point Ave, Bronx', borough:'Bronx (Hunts Point)', desc:'24/7 multi-service drop-in center for chronically homeless adults.', contact:'brc.org / (718) 893-3606', hours:'24/7', langs:'Spanish', cat:'housing' },
]

async function run() {
  // Seeded orgs have no owner — owner_id will be null

  let ok = 0, skip = 0, fail = 0
  for (const o of orgs) {
    const borough = parseBorough(o.borough)
    // Check duplicate
    const { data: ex } = await supabase.from('organizations').select('id').eq('name', o.name).maybeSingle()
    if (ex) { console.log(`SKIP: ${o.name}`); skip++; continue }
    // Geocode
    console.log(`Geocoding ${o.name}...`)
    const { lat, lng } = await geocode(o.address, borough)
    await new Promise(r => setTimeout(r, 1200)) // Nominatim rate limit
    // Insert org
    const { data: org, error: e1 } = await supabase.from('organizations').insert({
      // owner_id omitted — these are seeded orgs with no real owner account
      name: o.name, description: o.desc,
      borough, address: o.address, phone: parsePhone(o.contact),
      email: parseEmail(o.contact), website: parseWebsite(o.contact),
      status: 'approved',
      // approved_by omitted for seeded orgs
      approved_at: new Date().toISOString(),
      latitude: lat, longitude: lng,
      hours_of_operation: { general: o.hours },
      languages_supported: parseLangs(o.langs),
      category: [o.cat], is_active: true,
    }).select('id').single()
    if (e1) { console.error(`FAIL org ${o.name}:`, e1.message); fail++; continue }
    // Insert service
    const { error: e2 } = await supabase.from('services').insert({
      organization_id: org.id, name: o.name, description: o.desc,
      category: o.cat, borough, hours: o.hours,
      is_available: true, latitude: lat, longitude: lng,
    })
    if (e2) console.error(`FAIL service ${o.name}:`, e2.message)
    console.log(`✓ ${o.name} (${borough}) [${lat}, ${lng}]`)
    ok++
  }
  console.log(`\nDone: ${ok} imported, ${skip} skipped, ${fail} failed`)
}

run()

