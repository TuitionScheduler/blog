---
title: Can I take this course?
excerpt: An informative post detailing my experience writing a program that could determine if a student meets the prerequisites of a course they'd like to enroll in.
publishDate: 'Aug 15 2024'
tags:
  - Guide
isFeatured: true
---

# Can I take this course? Or, Programmatically Verifying Prerequisites of Courses From My University.

A while back I had this idea for recommending courses for students based on some general criteria like: “I want to graduate before X date”, “I don’t like more than X credits per term”, “I have taken X courses”. We could then take those recommended courses and then generate a link to our main app (matrical.site) so that students could proceed to generate schedules for the courses we recommend. In order to make course recommendation work smoothly, I needed to filter out all the courses that a student had either already taken or couldn’t take yet. The problem of figuring out if a student can take a course sounds like a very simple one. When I first encountered it, I phrased it as “You can take the course if you took all the ones that come before it”. In a lot of instances, this is actually pretty sound. For example, in order to take Calculus II you just have to take Calculus I. Since it looked so straightforward, I thought it would take 3-4 hours to write a python script that scrapes the courses from my university website, stores them in a SQLite DB, creates an in-memory map of courses to their prerequisite courses, and then allows me to input a student’s history alongside a course they wish to take. Under those assumptions, I got to work.

# Course Scraper

Our university doesn’t have anything like an API for querying courses, and my past attempts to have them create something like it have been… unsuccessful (ghosted, empty promises, etc.). Because of this, the only practical way (I don’t want to spend hours inputting courses into a database manually) of gathering the data we need is to scrape it for a location it is already available in.

Luckily, a friend had written a scraper for our university’s enrollment server (students SSH into it for enrollment, but it also just has a lot of course information). It was a good start, but it was terribly slow (8 minutes to scrape all the courses of each semester) and even had some reliability issues that were hard to fix without significant changes (blog post about this in the future?👀). While thinking of alternatives, I ended up looking up the course offering of the university and found that they straight up just had a website where you could search courses. This website seemed to be up to date with the student portal (a website for the online services of the university which has the course offering but requires that you be authenticated. It also has some annoying rate limiting) and didn’t have the rate limits, so it seemed perfect. I created a new Poetry project (Strongly recommend using it if you’re working with Python. Less hassle than pipenv or virtualenv), installed BeautifulSoup, and started scraping and parsing away. Fast-forward an hour and I could now extract all the fields of each course and its sections.

# Database

With the scraper completed, it was now time to store the course data in a persistent way. Since I’d be working with a small amount of data and I wanted an easy way to share it, SQLite was my go-to. Python can work with SQLite out of the box, but types are nice so I installed SQLAlchemy (INSERT LINK TO database.py here). I ended up with 3 tables: Courses, Sections, and Schedules.

The Courses table has data like when a course was given, its full name, and its co/prerequisites.

The Sections table stores the sections of all the courses, with each section having data like the professor(s).

Finally, the Schedules table stores the lecture times and locations of each section.

For my “Prerequisite Checker”, I only had to care about the Courses table, but it was handy to store the rest of the data for my other ventures. Below is the code defining the models:

```python
class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_code = Column(String(10), nullable=False)
    course_name = Column(String)
    year = Column(Integer, nullable=False)
    term = Column(String, nullable=False)
    credits = Column(Integer)
    department = Column(String)
    prerequisites = Column(String)
    corequisites = Column(String)

    # Define a one-to-many relationship between Course and Section
    sections = relationship("Section", back_populates="course")

    # Create indexes for term and year
    __table_args__ = (
        Index("idx_term", term),
        Index("idx_year", year),
        UniqueConstraint("course_code", "term", "year", name="uq_course_term_year"),
    )


class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, autoincrement=True)
    section_code = Column(String(5), nullable=False)
    meetings = Column(String)  # comma separated
    modality = Column(String)
    capacity = Column(Integer)
    taken = Column(Integer)
    reserved = Column(Boolean)
    professors = Column(String)  # comma separated
    misc = Column(String)  # comma separated

    # Define a many-to-one relationship between Section and Course
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    course = relationship("Course", back_populates="sections")

    # Define a one-to-many relationship between Section and Schedule
    schedules = relationship("Schedule", back_populates="section")
    grade_distributions = relationship("GradeDistribution", back_populates="section")
    __table_args__ = (
        UniqueConstraint("section_code", "course_id", name="unique_sections"),
    )


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    building = Column(String)
    room = Column(String)
    days = Column(String)
    start_time = Column(String)
    end_time = Column(String)

    # Define a many-to-one relationship between Schedule and Section
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    section = relationship("Section", back_populates="schedules")
```

# Interpreting Prerequisites

## Initial Approach: Splitting by Separators

My initial approach was straightforward. Assume that prerequisites are just strings containing courses separated by some delimiter (“O” or “Y”). To parse, we identify what the delimiter is, then we split by it, strip the space, and boom, a list of courses you have to take one of or all of to take the course. The will yield a tuple whose first value will be “&” to represent you have to take all the courses or “|” to mean you have to take one of the courses. The second value is the list of courses. For Calculus II, the prerequisites are “MATE3031 O MATE3144 O MATE3183”, so our simple approach would yield (“|”, \[MATE3031, MATE3144, MATE3183\]).

This approach falls apart when you take into account that some prerequisites are:

- Nested: (MATE3063 O MATE3185) Y MATE3020

- unrelated to courses: BIOL{12} Y DIR

As I looked through the database, I realized that there were many more cases than I had initially thought. I went back to the drawing board to find an approach that:

- Could handle new cases without significant refactors

- Could handle deeply nested requirements

## Revised Approach: Requirements As A Grammar

In my Programming Languages course we used the library PLY. PLY is a Python implementation of the lex and yacc tools commonly used to write parsers and compilers. We’d used PLY to make a simple blockchain-oriented programming language, and my positive experience using it made me look to it as the next version for my Prerequisite Checker. I would use PLY to convert the prerequisites string into an object that I could then store and work with whenever I wanted to evaluate if a student meets the prerequisites. The object would represent the prerequisites in a more structured way (I opted to represent the prerequisites as a nested Python dictionary) that could more easily be interpreted by a function.

To ensure that the approach was worth pursuing, I just had to validate that the requirements were actually a Context Free Grammar (Explaining CFGs is out of scope for this post). I looked at a few dozen prerequisites for courses and identified that the building blocks for prerequisites were:

- Requisites: “DIR” (director approval), “BIOL3000” (course), “BIOL{12}” (12 credits of Biology courses)
- Separators: “O”, “Y”, “O Y”, “Y/O” (more on the last two in the Sharp Bits section)
- Grouping Characters: “()”, “\[\]”

The first step is to tokenize the entire prerequisites string. This boils down to converting something like “MATE3031 O MATE3144 O MATE3183” into a list of tokens like \[Requisite, Separator, Requisite, Separator, Requisite\]. We can then write parsing rules that determine how you combine tokens together until you have parsed the entire string. If we were only worried about simple cases like Calculus II which have no grouping characters, we could capture requirements with the grammar:

1. B \-\> R | ε
2. R-\> R o R
3. R-\> R y R
4. R \-\> (course) | (director approval) | \<insert other individual requisites\>

If you’re unfamiliar with CFGs (and so the rules above make no sense), they are meant to recognize a “language” (a set of strings). At its core, a Context-Free Grammar (CFG) is a formal way to describe the structure of a language. CFGs are used to define the syntax rules of a language, be it natural languages like English (though English is actually a CSG [Context Sensitive Grammar] because of concepts like subject-verb agreement, where conjugation of verbs depends on the subject) or programming languages like Python. A CFG consists of a set of production rules that define how sentences in the language can be constructed.

Each rule specifies how a "non-terminal" symbol (which represents a concept or structure) can be replaced with a combination of other non-terminals and "terminal" symbols (which represent the actual characters or tokens in the language). Think of it like breaking down a sentence into smaller and smaller components until you’re left with the basic building blocks. For example, a rule in a CFG might state that a sentence can be split into a noun phrase and a verb phrase, and the noun phrase could be further broken down into an optional determiner (like "the") followed by a noun.

A CFG is "context-free" because the rules only depend on the structure being defined, not on surrounding elements. CFGs are commonly used in compilers, interpreters, and parsers to determine if a given string of code or text adheres to the language's rules.

A CFG accepts a string if the string can be generated from the base rule (in the rules I defined above, that would be “B”). If you apply the rules defined above, you can generate “(course) o (course) o (course)” which is the string representing the Calculus 2 requirements.

Many requisites are more complex than this example, so I’ll now break down the actual lexer and the parser I wrote.

### Lexer

Turns out there were a lot more requisite types than what I thought. My original estimate based on my experience during my degree is that there were around 4 types, but there were over double that. Below are all the requisites I wrote definitions for to recognize as individual tokens. To the parser, all the requisites will be treated the same, so when I tokenize a requisite, I convert it to a format that lets me identify what type of requisite it is (I opted to just convert the string into a dictionary with the keys “type” and “value”).

| Prerequisite Type        | Explanation                                                                                                                               | String Example (in Spanish)          |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| Credits Until Graduation | A student must have less than X amount of credits remaining in the degree associated with this course                                     | MENOS DE 19 CRS PARA GRADUACION      |
| Graduation Status        | A student must either be an undergraduate or must have already obtained a degree. Postgrad courses tend to have                           | GRADUADO                             |
| Credits With Pattern     | A student must have completed a certain number of credits in courses that match a specific pattern (e.g., courses in a particular field). | `[****3***, ****4***, ****5***]{24}` |
| Courses With pattern     | A student must have completed specific courses that match a certain pattern (e.g., courses in a particular subject).                      | `[****4***, ****5***] 4`             |
| English Level            | A student must have a certain proficiency in English, usually determined by a test or course completion.                                  | NIVEL_AVAN_INGL \> \#3               |
| Year                     | A student must be in a particular year of study (e.g., sophomore, junior).                                                                | 1ER                                  |
| Course                   | A student must have completed a specific course before enrolling in this course.                                                          | INSO4101                             |
| Exam                     | A student must have passed a particular exam to enroll in this course.                                                                    | EXA DIAG MATE                        |
| Department               | A student must be part of a specific department to enroll in this course.                                                                 | ADEM                                 |
| Program                  | A student must be enrolled in a specific program or minor to take the course.                                                             | 0503M                                |
| Director Approval        | A student must obtain approval from the course director or department head before enrolling.                                              | DIR                                  |

I could have broken up some of the requisite tokens into smaller components, but since I initially believed that each requisite was only ever written with a particular structure, I just opted to treat each entire requisite as a token (this does make the parser a bit simpler though as I have to define fewer rules).

Besides the requisite tokens, there are a few other tokens like the separators and grouping characters. To give a better idea as to what writing the tokenizer code looks like, below are two token definitions (if you want a more rigorous explanation of how to use PLY, go to [https://ply.readthedocs.io/en/latest/](https://ply.readthedocs.io/en/latest/)):

```python
def t_CREDITS_TO_GRADUATION_REQUIREMENT(t):

     r"MENOS\s+DE\s+\d+\s+CRS\s+PARA\s+GRADUACION"
    credits = re.search(r"\d+", t.value)
    t.value = {
        "type": "CREDITS_TO_GRADUATION_REQUIREMENT",
        "value": int(
            credits.group()  # type: ignore
        ),  # Read as: "You can graduate if you have fewer than these creds left"
    }
    return t

t_LPAREN = r"\("

t_RPAREN = r"\)"
```

The biggest challenge of the lexer was organizing the definitions so that the longest definitions are applied first. A string representing a credit requisite like “BIOL{12}” (read as “must have taken 12 credits in Biology”) starts with another valid requisite “BIOL”, but we want to tokenize it as a credit requisite since otherwise we have a “{12}” we don’t know what to do with. Since in a year I won’t have this codebase fresh in my head, I jotted down which token definitions are order sensitive. With the entire prerequisites input being tokenized, the next step was to write the parser.

### Parser

The parser is pretty straightforward. The goal is to combine every token into one (in this case, I named my base rule “prerequisite”). If we just have a single prerequisite, then our job is done. Every time we combine tokens, we produce a dictionary which represents the combination of the tokens (ie. combining two prerequisite tokens with the OR token produces a dictionary which has the list of prerequisites and a marker indicating that you only need to meet one of them).  
Below is how I wrote the rules for the OR group and for the grouped terms so you can see the dictionary representation in action.

```python
def p_or_group(p):
    """prerequisite : prerequisite OR prerequisite"""
    if p[1]["type"] == "OR" or p[3]["type"] == "OR":
        or_term = 1 if p[1]["type"] == "OR" else 3
        other_term = 3 if p[1]["type"] == "OR" else 1
        if p[other_term]["type"] == "OR":
            p[or_term]["conditions"].extend(p[other_term]["conditions"])
        else:
            p[or_term]["conditions"].append(p[other_term])
        p[0] = p[or_term]
    else:
        p[0] = {"type": "OR", "conditions": [p[1], p[3]]}

def p_grouped_term(p):
    """prerequisite : LPAREN prerequisite RPAREN"""
    p[0] = p[2]
```

I have another rule that recognizes all the requisite tokens as “prerequisite” so with these rules alone we can handle the single requisite case and the arbitrarily deeply nested case.

### Interpreting the Result

Once we have a single dictionary as the output of the parser, the next step is to write a function that can go through this dictionary programmatically and evaluate the prerequisites against a student's record. I opted for a function that returns a tuple containing if the student met the requisites and a string detailing what requisites are missing. The function itself isn't particularly interesting as it is just a big switch case to see if we either evaluate the prerequisite directly or recursively apply the function to all the prerequisites in an "or group" or "and group". Here is a snippet with both cases:

```python
           case "COURSES_WITH_PATTERN_REQUIREMENT":
                patterns = requisites["patterns"]
                requiredNumberOfCourses = requisites["courses"]
                qualifiedCourses = 0
                for takenCourse in student.completed_courses:
                    foundMatch = False
                    for pattern in patterns:
                        matches = True
                        for cChar, pChar in zip(takenCourse.courseCode, pattern):
                            if pChar != "*" and pChar != cChar:
                                matches = False
                                break
                        if matches:
                            foundMatch = True
                            break
                    if foundMatch:
                        qualifiedCourses += 1
                if qualifiedCourses >= requiredNumberOfCourses:
                    return True, ""
                else:
                    return (
                        False,
                        f"Needs {requiredNumberOfCourses} courses matching {patterns}, but only has {qualifiedCourses}",
                    )

            # recursively handle compound requirements
            case "OR":
                res = reduce(
                    lambda prev, curr: (
                        prev[0] or curr[0],
                        [] if prev[0] or curr[0] else prev[1] + [curr[1]],
                    ),
                    map(
                        lambda req: self.requisiteChecker(
                            student, course, req, hasDirectorApproval
                        ),
                        requisites["conditions"],
                    ),
                    (False, []),
                )
                success = res[0]
                missing = (
                    f"({' or '.join(res[1])})" if len(res[1]) > 1 else "".join(res[1])
                )
                return success, missing

```

I had all sorts of ideas like having an enum to describe the prerequisite type and making a type to model the prerequisite object to get some nice intellisense, but in the end, my goal was just to get something working, so python dictionaries stayed.

### Sharp Bits 🔪

Sadly, the university’s courses aren’t all entered into their database by a single person who makes no mistakes, so there are some cases which deviate from the patterns that I originally wrote code to recognize. I’ll detail some of those below

| Requisite Type       | Deviant Format                                                                                                            | Expected format                                                             |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------- |
| Credits With Pattern | `{5}(INCI4061 Y/O INCI4078 Y/O INCI4086 Y/O INCI4087 Y/O INCI4081 Y/O INCI4085 Y/O INCI4059 Y/O INCI4007)`                | `[INCI4061, INCI4078, INCI4086, INCI4087, INCI4081, INCI4085, INCI4059]{5}` |
| Course               | BIO3064 (yeah it’s just that the someone forgot the L :/ )                                                                | BIOL3064                                                                    |
| Credits With Pattern | {12}PSIC                                                                                                                  | PSIC{12}                                                                    |
| Credits With Pattern | `[****3****, ****4***, ****5***]{24}` (There is an extra `*` on the first term. There should only be 3 `*`’s after the 3) | `[****3***, ****4***, ****5***]{24}`                                        |

I opted to gracefully fail when the errors were related to typos, but added in some extra definitions to handle cases like {12}PSIC and “Y/O”.

# Conclusions

While the initial idea of determining if a student meets course prerequisites seemed straightforward, it quickly revealed itself to be a 10+ hour time sink, especially when dealing with the intricacies of nested and non-standard requirements. Big lesson here is that when you are working with data you don't own, spend some time understanding how it can deviate from your expectations.

Leveraging tools like PLY and understanding concepts like Context-Free Grammars allowed me to create a more flexible and maintainable system. Although I’ve paused the project due to challenges in gathering complete curriculum data, I achieved my goal of 100% prerequisite coverage, so should I ever pick it up again, I'll be on a good path.

For anyone considering a similar project, my advice is to ensure you have reliable access to the necessary data and that you udnerstand it well or at least know where to learn (I definitely did not understand all the prerequisites at our university before this project).
