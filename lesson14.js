// Generated compatibility alias; author lesson 14 in lessons/14.json.
window.LESSON14_CONTENT = window.COURSE_LIBRARY.lessons.find(lesson => lesson.number === 14);
window.LESSON14_CONTENT.exercises = [...window.LESSON14_CONTENT.sections.find(s => s.id === 'practice').html.matchAll(/<h3>([A-J])\. (.*?)<\/h3>([\s\S]*?)(?=<h3>|$)/g)].map(([,id,title,body]) => ({id,title,html:`<h3>${id}. ${title}</h3>${body}`}));
