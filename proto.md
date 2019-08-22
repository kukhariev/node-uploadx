#

## REQUESTS OVERVIEW

- `create:`

  ```http
  POST http://example.com/upload
  Content-Type: application/json; charset=UTF-8
  X-Upload-Content-Length: 2469036
  X-Upload-Content-Type: video/mp4

  {"name":"file.mp4","mimeType":"video/mp4","size":2469036,"lastModified":1497077951924}
  ```

  ```http
  HTTP/1.1 201 Created
  Location: //example.com/upload?upload_id=471e97554f21dec3b8bb5d4602939c51
  Content-Length: 0
  ```

  > If status code is 200, i.e. the file already exists, send a `resume` request

- `send chunk:`

  ```http
  PUT http://example.com/upload?upload_id=471e97554f21dec3b8bb5d4602939c51
  Content-Type: application/octet-stream
  Content-Range: bytes 0-262143/2469036
  Content-Length: 262144

  [BYTES 0-262143]
  ```

  ```http
  HTTP/1.1 308 Resume Incomplete
  Range: bytes=0-262143
  Content-Length: 0
  ```

- `send last chunk:`

  ```http
  PUT http://example.com/upload?upload_id=471e97554f21dec3b8bb5d4602939c51
  Content-Length: 634028
  Content-Range: bytes 1835008-2469035/2469036
  Content-Type: application/octet-stream

  [BYTES 1835008-2469035]
  ```

  ```http
  HTTP/1.1 200 OK
  Content-Length: 135
  Content-Type: application/json
  {"name":"file.mp4","mimeType":"video/mp4","size":2469036,"lastModified":1497077951924}
  ```

- `resume:`

  ```http
  PUT http://example.com/upload?upload_id=471e97554f21dec3b8bb5d4602939c51
  Content-Type: application/octet-stream
  Content-Range: bytes */2469036
  Content-Length: 0
  ```

  ```http
  HTTP/1.1 308 Resume Incomplete
  Range: bytes=0-1835007
  Content-Length: 0
  ```

- `cancel:`

  ```http
  DELETE http://example.com/upload?upload_id=471e97554f21dec3b8bb5d4602939c51
  Content-Length: 0
  ```

  ```http
  HTTP/1.1 204 No Content
  Content-Length: 0
  ```
