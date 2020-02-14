export const request = {
  create: {
    body: expect.any(String),
    // '{"metadata":{"name":"testfile.mp4","size":80495,"mimeType":"video/mp4","lastModified":1580413885165}}',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Upload-Content-Length': '80495',
      'X-Upload-Content-Type': 'video/mp4',
      Origin: 'http://api.com'
    },
    method: 'POST',
    params: { name: 'userId/testfile.mp4', size: 80495, uploadType: 'resumable' },
    url: expect.any(String)
  }
};
