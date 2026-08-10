
High Level Brief

Thanks for joining this last min remote hackathon organized out of real frustration!

We are looking to replace Sessionboard, which costs >$40k a year:
![image38.png](./brief-images/image38.png)

We do NOT expect to use everything... Which makes it easier for you to clone and makes less sense for us to pay. 

Primary features we are looking for from an open source clone that YOU make (and keep):
Custom call-for-speakers submission forms with conditional logic and category-based routing
Self-service speaker portal for bios, headshots, slides, and supporting documents
Automated, templated speaker communications, including reminders and calendar invites delivered directly to each speaker's own calendar (Gmail, Outlook, iCal)
Submission evaluation and scoring workflows, including optional AI-assisted review across multiple rounds
Drag-and-drop schedule and agenda building, with automatic conflict detection across rooms and tracks, viewable by list, day, week, track, or room
Real-time dashboard showing which speakers still have outstanding onboarding tasks
Native, one-way integration with Accelevents (our existing registration platform) to eliminate manual data re-entry
Resource and wiki pages within the speaker portal, including HTML embed support for existing reference material
Embeddable, mobile-friendly speaker gallery and schedule itinerary we can post to our website

Cloning the exact design is not a requirement; the point is to make a good-enough open source alternative that we never have to pay for this closed source SaaS if we can help it.

(IMPORTANT) Video Walkthrough: platform & requirements

https://youtu.be/vUuK4Knl7oc 

This is a very hastily recorded walkthrough going thru the requirements in detail with visual references for your clanker (UPDATE: SEE BELOW FOR SCREENSHOTS) - we will do a more polished one on Saturday and one on Sunday morning clarifying requirements based on your feedback, after which we will FREEZE adding any requirements so that you can have some certainty/polish.

more product walkthroughs for your clanker / yourself to validate https://learn.sessionboard.com/videos/overview
![image37.png](./brief-images/image37.png)
![image6.png](./brief-images/image6.png)

primarily interested in 
https://www.sessionboard.com/products/call-for-papers
https://www.sessionboard.com/capabilities/speaker-management
https://www.sessionboard.com/products/abstract-management
https://www.sessionboard.com/capabilities/content-management
https://www.sessionboard.com/capabilities/speaker-management
https://www.sessionboard.com/capabilities/conference-speaker-management
https://www.sessionboard.com/capabilities/ai-agenda (less so but cover the basics)
https://www.sessionboard.com/capabilities/sessions-list-1
List of Sessions
List of Speakers
Agenda
Schedule Itinerary
Speaker Gallery

participant POV https://learn.sessionboard.com/participants/overview
organizer POV https://learn.sessionboard.com/get-started/overview

extra features optional
https://www.sessionboard.com/products/speaker-crm

Discord

https://discord.gg/XYXaapF4q <- all updates and questions and communication here
Competition rules

Timeline: aim to be done in a weekend, but you may need more time esp because we are starting late, so:
you have until Wednesday Aug 12 10PM PT to submit!
Submission involves:
Fill out our form we will send out
Open source repo with your code
so that you walk away with something regardless
Deployed site we can test out with the walkthrough shown 
Because so many people signed up, I can’t proactively cover tokens, but people who SUBMIT valid attempts can ask for reimbursement for up to $500 in token cost (will ask for proof, and will subjectively judge if there was a real attempt made)
This includes people just using their codex pro/claude max subscriptions
The winning submission will:
Pass AIE team (not swyx) independent evaluation
Tiebreaker will go to whoever has made subjective judgment calls for the product that we would actually use/buy
Get $10,000 cash
Get on a call to do a walkthrough/interview for writeup on latent.space
Tech stack:
Choose whatever coding agents you want
Choose whatever language/tools/frameworks you want
Mild bonus points for deploy to Cloudflare infra
Bonus points for persistence/DB using Airtable
(Because those are what we use on our team)
Very teeny bonus points for hosting source code/site on Forge instead of GitHub
(because this is my side project)
Bonus points for speed/performance
we do not want slow SaaS pls
Bonus points for API
https://sessionboard.mintlify.app/introduction 

Questions welcome in Discord! https://discord.gg/XYXaapF4q 

SCREENSHOTS

Basic event config
![image29.png](./brief-images/image29.png)

![image25.png](./brief-images/image25.png)
![image41.png](./brief-images/image41.png)

Program > Submission Forms > Create
![image15.png](./brief-images/image15.png)

![image35.png](./brief-images/image35.png)
![image23.png](./brief-images/image23.png)
![image20.png](./brief-images/image20.png)![image1.png](./brief-images/image1.png)
![image27.png](./brief-images/image27.png)
![image2.png](./brief-images/image2.png)
![image21.png](./brief-images/image21.png)
![image36.png](./brief-images/image36.png)
![image9.png](./brief-images/image9.png)
![image7.png](./brief-images/image7.png)

Public CFP Page looks like this
https://appv2.sessionboard.com/submit/ai-engineer-sandbox-event/b7d4d7cd-3012-45c2-9c08-a8ee9185182f 
![image4.png](./brief-images/image4.png)
Speaker portal after submission
![image17.png](./brief-images/image17.png)

![image40.png](./brief-images/image40.png)
Program > Abstracts
![image5.png](./brief-images/image5.png)
![image13.png](./brief-images/image13.png)

![image14.png](./brief-images/image14.png)
![image10.png](./brief-images/image10.png)
![image8.png](./brief-images/image8.png)

Program > Agenda
![image30.png](./brief-images/image30.png)

Portal > Tasks 
For speakers to complete after admisssion
![image33.png](./brief-images/image33.png)

Portal > Forms
For speakers to fill out a form in a Task
![image18.png](./brief-images/image18.png)

![image22.png](./brief-images/image22.png)
![image26.png](./brief-images/image26.png)
![image28.png](./brief-images/image28.png)

![image24.png](./brief-images/image24.png)
![image16.png](./brief-images/image16.png)
CMS > Embeds (OPTIONAL)
![image39.png](./brief-images/image39.png)
![image12.png](./brief-images/image12.png)

Dashboard (optional but nice to have, best efforts)
![image32.png](./brief-images/image32.png)
![image19.png](./brief-images/image19.png)
![image42.png](./brief-images/image42.png)
![image11.png](./brief-images/image11.png)
![image31.png](./brief-images/image31.png)
![image34.png](./brief-images/image34.png)
![image3.png](./brief-images/image3.png)