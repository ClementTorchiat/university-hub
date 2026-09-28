import ical from 'node-ical';

async function test() {
  const data = await ical.async.fromURL('https://sedna.univ-fcomte.fr/jsp/custom/ufc/cal.jsp?data=c9d7a85235510d5267cb24b81b6875c97fa7f1638f5930127127f20d8ce22d603f422641b8c28c81b888658daa93b86c133ad6be6bb6ef8cca0bc1791f45d792f7b183be4495caf9eec3a69665831b45d14e86f8de2cd18eb4730003384b8c2e,1');
  
  let count = 0;
  for (const k in data) {
    if (data[k].type === 'VEVENT') {
      console.log('--- EVENT ---');
      console.log('SUMMARY:', data[k].summary);
      console.log('DESCRIPTION:', data[k].description);
      console.log('LOCATION:', data[k].location);
      count++;
      if (count > 3) break;
    }
  }
}

test();
