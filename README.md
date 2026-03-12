# Distributed Multiplayer Tetris Platform

**This project has been created as part of the 42 curriculum by dyarkovs, mperetia, asmolnya**

## Description

A distributed multiplayer Tetris platform enabling real-time gameplay through the browser.
The project features a JavaScript game engine handling match logic, a Node.js backend built
as microservices for authentication, matchmaking, and data management, and a React frontend
providing the user interface.

## Instructions
(section containing any relevant information about compilation,
installation, and/or execution).

## Resources
Resources will be added in the process of work under the project.

## Main plan:

- Web: Use frameworks (frontend + backend = 2pts) + ORM (1pt) = 3 points
- Accessibility and Internationalization: 3 browsers supoport (1pt) = 1 point
- Gaming and user experience: Web-based game (2pts) + Remote players (2pts) + Multiplayer (2pts) + Game customization (1pt) + Spectator mode (1pt)  = 8 points
- User Management: Standard user management (2pts) + OAuth (1pt) + Game statistics (1pt) = 4 points
- DevOps: Backend as microservices (2pts) = 2 points  

#### Total points: 3 + 1 + 8 + 4 + 2 = 18 points

<br/>

#### Additional features (optional to do):

- Web: public API with 5 endpoints (2 pts) + advanced search and filters/sorting (1pt) = 3 points
- Accessibility and Internationalization: Multiple languages support (1pt) + Right-to-Left (1pt) = 2 points
- Gaming and user experience: + Tournament system (1pt) + Another game (2pts) + 3D Graphics in game (2pts) + Gamification system/achievement (1pt) = 6 points
- User Management: + Advanced permission system (2pts) = 2 points
- Artificial Intelligence: AI Opponent (2pts) = 2 points
- Cybersecurity: WAF/ModSecurity and HashiCorp Vault (2pts) = 2 points
- DevOps: ELK (2pts) + Prometheus and Grafana (2pts) = 4 points  

##### Total points: 3 + 2 + 6 + 2 + 2 + 2 + 4 = 21 points

## IV.1 Web
#### Major: Use a framework for both the frontend and backend. +  
- Use a frontend framework (React). - Masha  
- Use a backend framework (Express/Fastify, Node.js). - Sasha, Dasha  

#### Major: Implement real-time features using WebSockets or similar technology.   + Dasha  
- Real-time updates across clients.  
- Handle connection/disconnection gracefully.  
- Efficient message broadcasting.  

#### Major: Allow users to interact with other users.  + Masha(Front), Sasha (Back) 
The minimum requirements are:
- A basic chat system (send/receive messages between users).  
- A profile system (view user information).  
- A friends system (add/remove friends, see friends list).  

#### Major: A public API to interact with the database with a secured API key, rate   + Sasha(Back, DB), maybe Masha(if the secure key is needed on Front to be approved)  
limiting, documentation, and at least 5 endpoints:  
- GET /api/{something}  
- POST /api/{something}  
- PUT /api/{something}  
- DELETE /api/{something}  

#### Minor: Use an ORM for the database. (Sqlite, Sequalize, Prisma - on Postgres)  +/- Sasha

#### Minor: A complete notification system for all creation, update, and deletion actions.  

#### Minor: Implement advanced search functionality with filters, sorting, and pagination. (one table and place)  - Masha(Front), Sasha(back, DB)

## IV.2 Accessibility and Internationalization
#### Minor: Support for multiple languages (at least 3 languages).   (We're doing only if we have a time and need it!) ?  
- Implement i18n (internationalization) system.  
- At least 3 complete language translations.  
- Language switcher in the UI.  
- All user-facing text must be translatable.  

#### Minor: Right-to-left (RTL) language support.   (Do we need to thing about it in advance in terms of Frontend components placement?. Still do only if have time.) ?  
- Support for at least one RTL language (Arabic, Hebrew, etc.).  
- Complete layout mirroring (not just text direction).  
- RTL-specific UI adjustments where needed.  
- Seamless switching between LTR and RTL.  

#### Minor: Support for additional browsers.   + Masha (Front)  
- Full compatibility with at least 2 additional browsers (Firefox, Safari, Edge, etc.).  
- Test and fix all features in each browser.  
- Document any browser-specific limitations.  
- Consistent UI/UX across all supported browsers.

## IV.3 User Management
#### Major: Standard user management and authentication.  Sasha(back), Masha (Front) + 
- Users can update their profile information.  
- Users can upload an avatar (with a default avatar if none provided).  
- Users can add other users as friends and see their online status.  
- Users have a profile page displaying their information.  

#### Minor: Game statistics and match history (requires a game module).   + Masha(Front), Sasha(Back)  
- Track user game statistics (wins, losses, ranking, level, etc.).  
- Display match history (1v1 games, dates, results, opponents).  
- Show achievements and progression.  
- Leaderboard integration.  

#### Minor: Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.).    +  

#### Major: Advanced permissions system:   ?  
- View, edit, and delete users (CRUD).  
- Roles management (admin, user, guest, moderator, etc.).  
- Different views and actions based on user role.

## IV.4 Artificial Intelligence 
#### Major: Introduce an AI Opponent for games.    +/- ? 
- The AI must be challenging and able to win occasionally.  
- The AI should simulate human-like behavior (not perfect play).  
- If you implement game customization options, the AI must be able to use them.  
- You must be able to explain your AI implementation during evaluation.

## IV.5 Cybersecurity 
#### Major: Implement WAF/ModSecurity (hardened) + HashiCorp Vault for secrets:    + Sasha 
- Configure strict ModSecurity/WAF.  
- Manage secrets in Vault (API keys, credentials, environment variables), encrypted and isolated.

## IV.6 Gaming and user experience
#### Major: Implement a complete web-based game where users can play against each    + Masha (Front and logics), Dasha (Back server) other.  
- The game can be real-time multiplayer (e.g., Pong, Chess, Tic-Tac-Toe, Card games, etc.).  
- Players must be able to play live matches.  
- The game must have clear rules and win/loss conditions.  
- The game can be 2D or 3D.  

#### Major: Remote players — Enable two players on separate computers to play the    + Masha (Front and logics), Dasha (Back server)
same game in real-time.  
- Handle network latency and disconnections gracefully.  
- Provide a smooth user experience for remote gameplay.  
- Implement reconnection logic.  

#### Major: Multiplayer game (more than two players).   + Masha (Front and logics), Dasha (Back server)  
- Support for three or more players simultaneously.  
- Fair gameplay mechanics for all participants.  
- Proper synchronization across all clients.  

#### Major: Add another game with user history and matchmaking.    ? -/+  
- Implement a second distinct game.  
- Track user history and statistics for this game.  
- Implement a matchmaking system.  
- Maintain performance and responsiveness.  

#### Major: Implement advanced 3D graphics using a library like Three.js or Babylon.js.    ? -/+  
- Create an immersive 3D environment.  
- Implement advanced rendering techniques.  
- Ensure smooth performance and user interaction.  

#### Minor: Advanced chat features (enhances the basic chat from "User interaction" module).    ? -/+  
- Ability to block users from messaging you.  
- Invite users to play games directly from chat.  
- Game/tournament notifications in chat.  
- Access to user profiles from chat interface.  
- Chat history persistence.  
- Typing indicators and read receipts.  

#### Minor: Implement a tournament system.    + ?  
- Clear matchup order and bracket system.  
- Track who plays against whom.  
- Matchmaking system for tournament participants.  
- Tournament registration and management.  

#### Minor: Game customization options.    + Masha  
- Power-ups, attacks, or special abilities.  
- Different maps or themes.  
- Customizable game settings.  
- Default options must be available.  

#### Minor: A gamification system to reward users for their actions.    +/-  
- Implement at least 3 of the following: achievements, badges, leaderboards, XP/level system, daily challenges, rewards  
- System must be persistent (stored in database)
- Visual feedback for users (notifications, progress bars, etc.)  
- Clear rules and progression mechanics  

#### Minor: Implement spectator mode for games.   + (Dasha)  
- Allow users to watch ongoing games.  
- Real-time updates for spectators.  
- Optional: spectator chat.

## IV.7 DevOps
#### Major: Infrastructure for log management using ELK (Elasticsearch, Logstash, Kibana).    + Sasha
- Elasticsearch to store and index logs.  
- Logstash to collect and transform logs.  
- Kibana for visualization and dashboards.  
- Implement log retention and archiving policies.  
- Secure access to all components.  

#### Major: Monitoring system with Prometheus and Grafana.    + Sasha  
- Set up Prometheus to collect metrics.  
- Configure exporters and integrations.  
- Create custom Grafana dashboards.  
- Set up alerting rules.  
- Secure access to Grafana.  

#### Major: Backend as microservices.    + Sasha  
- Design loosely-coupled services with clear interfaces.  
- Use REST APIs or message queues for communication.  
- Each service should have a single responsibility**
