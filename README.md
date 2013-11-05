# Jekyll Slides Template

This project is a starting point for an HTML-based slideshow system.

By using [Jekyll](http://jekyllrb.com), we can easily build our final
product using Markdown.

## Supported Browsers

I have tested this in Chrome and Mobile Safari. The dragging interface on
mobile is admittedly janky, but it is at least functional. :)

## Usage

### Installation

Install Jekyll on your computer. For instructions, look to
[http://jekyllrb.com](http://jekyllrb.com) for the most up-to-date
info.

Start the local server/HTML builder by executing `jekyll serve --watch` on the
command line. This will rebuild the HTML and start a server listening
on port 4000. It will watch for changes to your slides source document
and rebuild them.

To see your slides as you work, point your browser to
[http://localhost:4000](http://localhost:4000).

### Creating Slides

Edit `index.md` to create your slides. An `HR` tag delineates
slides. To create one in Markdown, put three hyphens in a row on a
line by themselves. Anything contained between these markers is a
slide.

### Deploying

Once Jekyll has built your slides, you can copy the `_site/` folder to
a fileserver to make it available to the world. Once built, no
server-side software is required.

## Bonus Stuff

### Outline Mode

if you add `&outline` to your URL when viewing your slides, you will
see an outline mode. For example, on localhost this is:
[http://localhost:4000/?outline](http://localhost:4000/?outline).

Outline mode takes the first H1, H2, and H3 elements on your slides
and present them in a table. It can serve as a broad overview, perhaps
on a tablet, to help you keep your place during a talk.

### Basic Diagrams

Included in this package is a [DITAA](http://ditaa.sourceforge.net/)
plugin. It allows you to use ASCII to create basic diagrams which will
be converted to slightly more aesthetic images. To include a diagram,
wrap a DITAA-compatable diagram in {% ditaa %} / {% endditaa %} liquid
tags. For example:

        {% ditaa %}
            +---------+
            | Huzzah! |
            +---------+
        {% endditaa %}

See the DITAA documentation for available features.

To use this, you must install DITAA on your system. On OSX, I used
brew: `brew install ditaa`, which worked smashingly.

**NOTE** This plugin works by spinning up a Java application for each
new diagram it must create. This can be sluggish and annoying. Also,
as you develop a diagram, it will create many stray image files.
Before publishing your slides or committing to a repository, I
recommend emptying the `images/ditaa` folder and rerunning Jekyll to
remove the stray images.


