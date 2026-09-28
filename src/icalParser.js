import ical from 'node-ical';

export async function fetchADESchedule(url) {
  try {
    const data = await ical.async.fromURL(url);
    const events = [];
    
    for (const k in data) {
      if (data.hasOwnProperty(k)) {
        const ev = data[k];
        if (ev.type === 'VEVENT') {
          // Format the event to match our UI expectations
          // ADE events usually have summary (title) and location (room)
          
          let rawTitle = ev.summary || 'Cours';
          let room = ev.location || '';
          
          // Clean up title (e.g. "ELC1 - Conception des PSM" -> "Conception des PSM")
          let title = rawTitle;
          if (rawTitle.includes(' - ')) {
            title = rawTitle.split(' - ').slice(1).join(' - ').trim();
          } else {
            title = rawTitle.split('\n')[0].trim();
          }
          
          // Extract professor from description
          let prof = '';
          if (ev.description) {
            const descLines = ev.description.split('\n').map(l => l.trim()).filter(l => l);
            for (const line of descLines) {
              // Match ALL CAPS lines that are not CM/TD/TP
              if (line.match(/^[A-ZÀ-ÖØ-Þ \\-]+$/) && line !== 'CM' && line !== 'TP' && line !== 'TD') {
                prof = line;
                break;
              }
            }
          }
          
          const start = new Date(ev.start);
          const end = new Date(ev.end);
          
          // We format the time as "HH:MM - HH:MM"
          const timeFormat = new Intl.DateTimeFormat('fr-FR', {
            hour: '2-digit', minute: '2-digit'
          });
          const timeStr = `${timeFormat.format(start)} - ${timeFormat.format(end)}`;
          
          events.push({
            id: ev.uid,
            title,
            room,
            prof,
            time: timeStr,
            startTime: start.getTime(),
            endTime: end.getTime()
          });
        }
      }
    }
    
    // Sort events by start time
    events.sort((a, b) => a.startTime - b.startTime);
    
    // Filter out past events (keep only from today onwards)
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    const futureEvents = events.filter(e => e.endTime >= now.getTime());
    
    return futureEvents;
    
  } catch (error) {
    console.error('Erreur lors de la récupération de ADE:', error);
    return null; // Return null to indicate failure
  }
}
