## What is the difference between a web server and a database?
A web server is like a CPU that recieves the input/ instructions from the end user and processes it to a proper defined output back to the client side. It is usually kept active to keep the web service running. A web server is mostly not present in the end user's machine, instead it is located elsewhere in the world and is connected through internet to the user's browser.
Meanwhile a database is simply a storage space for both frontend and backend activites, and the stored data is for further, later usage. A database mostly does nothing but store data in a easy to manage format.

Example of web server: ChatGPT models running AI in the backend to answer user queries
Example of database: Google drive.

## Why should frontend NOT talk directly to database?
(Answer being assumed not sure about it though) Frontend lacks data processing techniques which makes it difficult to both store and retrieve data easily. It also has a chance of becoming a synchronous process and leading to more time consumption for the user.

## Client server architecture
A complete web system that is used for efficient process, where the user sees only the frontend part and interacts with it, providing input to be processed in the backend. The client is the frontend. The server is the backend that handles requests from client and responds to them, also handling database insertion and retrieval.