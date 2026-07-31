import https from 'https';

const options = {
  hostname: 'frgkrogebppzqqapsuga.supabase.co',
  port: 443,
  path: '/rest/v1/chat_messages?select=id,profile:profiles!chat_messages_user_id_fkey(display_name),reply_to:chat_messages!reply_to_id(content,profile:profiles!chat_messages_user_id_fkey(display_name)),reactions:chat_reactions(emoji,user_id,profile:profiles(display_name))&limit=1',
  method: 'GET',
  headers: {
    'apikey': 'sb_publishable_YJWjH57SJBzrCaoRB2fIEQ_cl_zZ4iA',
    'Authorization': 'Bearer sb_publishable_YJWjH57SJBzrCaoRB2fIEQ_cl_zZ4iA'
  },
  rejectUnauthorized: false
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', error => console.error(error));
req.end();
