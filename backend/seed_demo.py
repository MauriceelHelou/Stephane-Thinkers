"""
Seed a realistic Western intellectual-genealogy dataset for timeline density testing.

~88 real thinkers (antiquity → present), school-of-thought tags (colorblind-safe
Okabe-Ito / Tol palette), influence connections, intellectual-history events, and
a couple of canvas notes. The 1850–1950 cluster intentionally produces ~25-30
overlapping lifespans — the worst case for the lane-packing layout engine.

Run from backend/:  python seed_demo.py
"""
from app.database import SessionLocal, engine, Base
from app.models.thinker import Thinker
from app.models.tag import Tag
from app.models.connection import Connection, ConnectionType
from app.models.timeline import Timeline
from app.models.timeline_event import TimelineEvent
from app.models.note import Note

# School-of-thought tags: (key, display name, hex color) — Okabe-Ito 8 + Tol 4.
TAGS = [
    ("anc",   "Ancient & Classical",   "#E69F00"),
    ("med",   "Medieval & Scholastic", "#CC79A7"),
    ("rat",   "Rationalism",           "#0072B2"),
    ("emp",   "Empiricism",            "#56B4E9"),
    ("idl",   "German Idealism",       "#009E73"),
    ("exi",   "Existentialism",        "#D55E00"),
    ("phe",   "Phenomenology",         "#F0E442"),
    ("crit",  "Critical Theory",       "#882255"),
    ("ana",   "Analytic",              "#44AA99"),
    ("prag",  "Pragmatism",            "#999933"),
    ("soc",   "Sociology",             "#AA4499"),
    ("struc", "Structuralism & Post-", "#332288"),
]

# (name, birth, death, field, [tag keys]). death=None => living (open-ended bar).
THINKERS = [
    # --- Ancient & Classical ---
    ("Thales", -624, -546, "Philosophy", ["anc"]),
    ("Pythagoras", -570, -495, "Mathematics", ["anc"]),
    ("Heraclitus", -535, -475, "Philosophy", ["anc"]),
    ("Parmenides", -515, -450, "Philosophy", ["anc"]),
    ("Socrates", -470, -399, "Philosophy", ["anc"]),
    ("Democritus", -460, -370, "Philosophy", ["anc"]),
    ("Plato", -428, -348, "Philosophy", ["anc"]),
    ("Aristotle", -384, -322, "Philosophy", ["anc"]),
    ("Epicurus", -341, -270, "Philosophy", ["anc"]),
    ("Zeno of Citium", -334, -262, "Philosophy", ["anc"]),
    ("Cicero", -106, -43, "Philosophy", ["anc"]),
    ("Seneca", -4, 65, "Philosophy", ["anc"]),
    ("Marcus Aurelius", 121, 180, "Philosophy", ["anc"]),
    ("Plotinus", 204, 270, "Philosophy", ["anc"]),
    # --- Medieval & Scholastic ---
    ("Augustine of Hippo", 354, 430, "Theology", ["med"]),
    ("Boethius", 477, 524, "Philosophy", ["med"]),
    ("Avicenna", 980, 1037, "Philosophy", ["med"]),
    ("Anselm of Canterbury", 1033, 1109, "Theology", ["med"]),
    ("Averroes", 1126, 1198, "Philosophy", ["med"]),
    ("Maimonides", 1138, 1204, "Theology", ["med"]),
    ("Thomas Aquinas", 1225, 1274, "Theology", ["med"]),
    ("Duns Scotus", 1266, 1308, "Theology", ["med"]),
    ("William of Ockham", 1287, 1347, "Philosophy", ["med"]),
    # --- Renaissance / Early Modern ---
    ("Niccolo Machiavelli", 1469, 1527, "Political Theory", []),
    ("Francis Bacon", 1561, 1626, "Philosophy", ["emp"]),
    ("Galileo Galilei", 1564, 1642, "Science", ["emp"]),
    ("Thomas Hobbes", 1588, 1679, "Political Theory", ["emp"]),
    ("Rene Descartes", 1596, 1650, "Philosophy", ["rat"]),
    ("Blaise Pascal", 1623, 1662, "Philosophy", ["rat"]),
    ("Baruch Spinoza", 1632, 1677, "Philosophy", ["rat"]),
    ("John Locke", 1632, 1704, "Philosophy", ["emp"]),
    ("Isaac Newton", 1643, 1727, "Science", ["emp"]),
    ("Gottfried Leibniz", 1646, 1716, "Philosophy", ["rat"]),
    ("George Berkeley", 1685, 1753, "Philosophy", ["emp"]),
    ("Montesquieu", 1689, 1755, "Political Theory", []),
    ("Voltaire", 1694, 1778, "Philosophy", []),
    ("David Hume", 1711, 1776, "Philosophy", ["emp"]),
    ("Jean-Jacques Rousseau", 1712, 1778, "Political Theory", []),
    ("Adam Smith", 1723, 1790, "Economics", ["emp"]),
    ("Immanuel Kant", 1724, 1804, "Philosophy", ["idl", "rat"]),
    ("Edmund Burke", 1729, 1797, "Political Theory", []),
    ("Jeremy Bentham", 1748, 1832, "Philosophy", ["emp"]),
    ("Mary Wollstonecraft", 1759, 1797, "Political Theory", []),
    # --- 19th century ---
    ("Friedrich Schleiermacher", 1768, 1834, "Theology", ["idl"]),
    ("Georg W. F. Hegel", 1770, 1831, "Philosophy", ["idl"]),
    ("Arthur Schopenhauer", 1788, 1860, "Philosophy", ["idl"]),
    ("Auguste Comte", 1798, 1857, "Sociology", ["soc"]),
    ("John Stuart Mill", 1806, 1873, "Philosophy", ["emp", "prag"]),
    ("Charles Darwin", 1809, 1882, "Science", []),
    ("Soren Kierkegaard", 1813, 1855, "Philosophy", ["exi"]),
    ("Karl Marx", 1818, 1883, "Political Theory", ["crit", "idl"]),
    ("Friedrich Engels", 1820, 1895, "Political Theory", ["crit"]),
    ("Herbert Spencer", 1820, 1903, "Sociology", ["soc"]),
    ("Wilhelm Dilthey", 1833, 1911, "Philosophy", ["phe"]),
    ("Charles Sanders Peirce", 1839, 1914, "Philosophy", ["prag"]),
    ("William James", 1842, 1910, "Philosophy", ["prag"]),
    ("Friedrich Nietzsche", 1844, 1900, "Philosophy", ["exi"]),
    ("Gottlob Frege", 1848, 1925, "Logic", ["ana"]),
    ("Ferdinand de Saussure", 1857, 1913, "Linguistics", ["struc"]),
    ("Sigmund Freud", 1856, 1939, "Psychology", []),
    ("Emile Durkheim", 1858, 1917, "Sociology", ["soc"]),
    ("Edmund Husserl", 1859, 1938, "Philosophy", ["phe"]),
    ("John Dewey", 1859, 1952, "Philosophy", ["prag"]),
    ("Henri Bergson", 1859, 1941, "Philosophy", []),
    ("Max Weber", 1864, 1920, "Sociology", ["soc"]),
    # --- 20th century ---
    ("Bertrand Russell", 1872, 1970, "Philosophy", ["ana"]),
    ("Ludwig Wittgenstein", 1889, 1951, "Philosophy", ["ana"]),
    ("Martin Heidegger", 1889, 1976, "Philosophy", ["phe", "exi"]),
    ("Walter Benjamin", 1892, 1940, "Critical Theory", ["crit"]),
    ("Herbert Marcuse", 1898, 1979, "Critical Theory", ["crit"]),
    ("Theodor Adorno", 1903, 1969, "Critical Theory", ["crit"]),
    ("Jean-Paul Sartre", 1905, 1980, "Philosophy", ["exi", "phe"]),
    ("Hannah Arendt", 1906, 1975, "Political Theory", []),
    ("Maurice Merleau-Ponty", 1908, 1961, "Philosophy", ["phe"]),
    ("Simone de Beauvoir", 1908, 1986, "Philosophy", ["exi"]),
    ("W. V. O. Quine", 1908, 2000, "Philosophy", ["ana"]),
    ("Claude Levi-Strauss", 1908, 2009, "Anthropology", ["struc"]),
    ("Albert Camus", 1913, 1960, "Philosophy", ["exi"]),
    ("Roland Barthes", 1915, 1980, "Literary Theory", ["struc"]),
    ("Louis Althusser", 1918, 1990, "Philosophy", ["crit", "struc"]),
    ("John Rawls", 1921, 2002, "Political Theory", []),
    ("Thomas Kuhn", 1922, 1996, "Philosophy of Science", []),
    ("Michel Foucault", 1926, 1984, "Philosophy", ["struc", "crit"]),
    ("Jurgen Habermas", 1929, None, "Critical Theory", ["crit"]),
    ("Jacques Derrida", 1930, 2004, "Philosophy", ["struc"]),
    ("Pierre Bourdieu", 1930, 2002, "Sociology", ["soc", "struc"]),
    ("Richard Rorty", 1931, 2007, "Philosophy", ["prag", "ana"]),
    ("Judith Butler", 1956, None, "Philosophy", ["crit"]),
]

# (from, to, type) — influence edges, concentrated in the dense modern cluster.
CONNECTIONS = [
    ("Socrates", "Plato", "influenced"),
    ("Plato", "Aristotle", "influenced"),
    ("Plato", "Plotinus", "influenced"),
    ("Aristotle", "Averroes", "influenced"),
    ("Aristotle", "Thomas Aquinas", "influenced"),
    ("Averroes", "Thomas Aquinas", "influenced"),
    ("Augustine of Hippo", "Thomas Aquinas", "influenced"),
    ("Thomas Aquinas", "Duns Scotus", "critiqued"),
    ("Duns Scotus", "William of Ockham", "critiqued"),
    ("Rene Descartes", "Baruch Spinoza", "influenced"),
    ("Rene Descartes", "Gottfried Leibniz", "influenced"),
    ("John Locke", "George Berkeley", "influenced"),
    ("John Locke", "David Hume", "influenced"),
    ("George Berkeley", "David Hume", "influenced"),
    ("David Hume", "Immanuel Kant", "influenced"),
    ("Gottfried Leibniz", "Immanuel Kant", "influenced"),
    ("Immanuel Kant", "Georg W. F. Hegel", "built_upon"),
    ("Immanuel Kant", "Arthur Schopenhauer", "built_upon"),
    ("Georg W. F. Hegel", "Karl Marx", "synthesized"),
    ("Georg W. F. Hegel", "Soren Kierkegaard", "critiqued"),
    ("Karl Marx", "Friedrich Engels", "synthesized"),
    ("Arthur Schopenhauer", "Friedrich Nietzsche", "influenced"),
    ("Soren Kierkegaard", "Martin Heidegger", "influenced"),
    ("Soren Kierkegaard", "Jean-Paul Sartre", "influenced"),
    ("Friedrich Nietzsche", "Martin Heidegger", "influenced"),
    ("Friedrich Nietzsche", "Michel Foucault", "influenced"),
    ("Edmund Husserl", "Martin Heidegger", "built_upon"),
    ("Edmund Husserl", "Maurice Merleau-Ponty", "influenced"),
    ("Edmund Husserl", "Jean-Paul Sartre", "influenced"),
    ("Edmund Husserl", "Hannah Arendt", "influenced"),
    ("Martin Heidegger", "Jean-Paul Sartre", "influenced"),
    ("Martin Heidegger", "Hannah Arendt", "influenced"),
    ("Martin Heidegger", "Jacques Derrida", "influenced"),
    ("Gottlob Frege", "Bertrand Russell", "influenced"),
    ("Bertrand Russell", "Ludwig Wittgenstein", "influenced"),
    ("Ludwig Wittgenstein", "W. V. O. Quine", "influenced"),
    ("Ferdinand de Saussure", "Claude Levi-Strauss", "influenced"),
    ("Ferdinand de Saussure", "Roland Barthes", "influenced"),
    ("Claude Levi-Strauss", "Michel Foucault", "influenced"),
    ("Karl Marx", "Theodor Adorno", "influenced"),
    ("Karl Marx", "Herbert Marcuse", "influenced"),
    ("Karl Marx", "Louis Althusser", "synthesized"),
    ("Georg W. F. Hegel", "Theodor Adorno", "influenced"),
    ("Sigmund Freud", "Herbert Marcuse", "synthesized"),
    ("Theodor Adorno", "Jurgen Habermas", "built_upon"),
    ("Charles Sanders Peirce", "William James", "influenced"),
    ("William James", "John Dewey", "influenced"),
    ("John Dewey", "Richard Rorty", "influenced"),
    ("Ludwig Wittgenstein", "Richard Rorty", "influenced"),
    ("Auguste Comte", "Emile Durkheim", "influenced"),
    ("Emile Durkheim", "Pierre Bourdieu", "influenced"),
    ("Max Weber", "Jurgen Habermas", "influenced"),
    ("Jeremy Bentham", "John Stuart Mill", "built_upon"),
    ("John Stuart Mill", "John Rawls", "influenced"),
    ("Simone de Beauvoir", "Judith Butler", "influenced"),
    ("Michel Foucault", "Judith Butler", "influenced"),
]

# (name, year, end_year, event_type) — intellectual-history milestones.
EVENTS = [
    ("Plato founds the Academy", -387, None, "cultural"),
    ("Aristotle founds the Lyceum", -334, None, "cultural"),
    ("Fall of Rome", 476, None, "political"),
    ("Aquinas' Summa Theologica", 1265, 1274, "publication"),
    ("Gutenberg printing press", 1440, None, "invention"),
    ("Fall of Constantinople", 1453, None, "political"),
    ("Descartes' Discourse on Method", 1637, None, "publication"),
    ("Newton's Principia", 1687, None, "publication"),
    ("Kant's Critique of Pure Reason", 1781, None, "publication"),
    ("French Revolution", 1789, 1799, "political"),
    ("Hegel's Phenomenology of Spirit", 1807, None, "publication"),
    ("Darwin's Origin of Species", 1859, None, "publication"),
    ("Marx's Das Kapital", 1867, None, "publication"),
    ("Freud's Interpretation of Dreams", 1899, None, "publication"),
    ("Principia Mathematica", 1910, 1913, "publication"),
    ("Heidegger's Being and Time", 1927, None, "publication"),
    ("Sartre's Being and Nothingness", 1943, None, "publication"),
    ("Kuhn's Structure of Scientific Revolutions", 1962, None, "publication"),
    ("Rawls' A Theory of Justice", 1971, None, "publication"),
]

# Canvas notes with multi-sentence paragraphs to exercise inline word-wrap.
NOTES = [
    {
        "title": "Genealogy of Critique",
        "content": (
            "The critical tradition descends from Kant's transcendental turn through "
            "Hegel's dialectic into Marx's critique of political economy. The Frankfurt "
            "School (Benjamin, Adorno, Marcuse) fused this with Freudian psychoanalysis, "
            "and Habermas later reoriented it toward communicative reason."
        ),
        "color": "blue",
        "position_x": 1400.0,
        "position_y": 360.0,
    },
    {
        "title": "Phenomenology lineage",
        "content": (
            "Husserl's call back 'to the things themselves' seeds Heidegger's existential "
            "analytic, Sartre's and Merleau-Ponty's embodied phenomenology, and feeds the "
            "hermeneutic and post-structural turns that follow."
        ),
        "color": "yellow",
        "position_x": 1650.0,
        "position_y": 520.0,
    },
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Idempotent reset (FK-safe order).
        db.query(Connection).delete()
        db.query(Note).delete()
        db.query(TimelineEvent).delete()
        db.execute(Thinker.__table__.delete())
        # clear M:M join then tags
        from app.models.thinker import Thinker as T
        db.execute(__import__("sqlalchemy").text("DELETE FROM thinker_tags"))
        db.query(Tag).delete()
        db.query(Timeline).delete()
        db.commit()

        timeline = Timeline(name="Western Intellectual Genealogy",
                            start_year=-650, end_year=2025,
                            description="Antiquity to the present: 88 thinkers across twelve schools.")
        db.add(timeline)
        db.flush()

        tag_by_key = {}
        for key, name, color in TAGS:
            t = Tag(name=name, color=color)
            db.add(t)
            tag_by_key[key] = t
        db.flush()

        thinker_by_name = {}
        for name, birth, death, field, tagkeys in THINKERS:
            th = Thinker(
                name=name, birth_year=birth, death_year=death, field=field,
                anchor_year=birth, timeline_id=timeline.id,
                is_manually_positioned=False, position_y=None,
                tags=[tag_by_key[k] for k in tagkeys],
            )
            db.add(th)
            thinker_by_name[name] = th
        db.flush()

        missing = set()
        for frm, to, ctype in CONNECTIONS:
            a, b = thinker_by_name.get(frm), thinker_by_name.get(to)
            if not a or not b:
                missing.add(frm if not a else to)
                continue
            db.add(Connection(from_thinker_id=a.id, to_thinker_id=b.id,
                              connection_type=ConnectionType(ctype)))

        for name, year, end_year, etype in EVENTS:
            db.add(TimelineEvent(timeline_id=timeline.id, name=name, year=year,
                                 end_year=end_year, event_type=etype))

        for n in NOTES:
            db.add(Note(title=n["title"], content=n["content"], note_type="research",
                        is_canvas_note=True, color=n["color"],
                        position_x=n["position_x"], position_y=n["position_y"]))

        db.commit()

        print(f"Seeded: {len(THINKERS)} thinkers, {len(TAGS)} tags, "
              f"{len(CONNECTIONS) - len(missing)} connections, {len(EVENTS)} events, "
              f"{len(NOTES)} notes.")
        print(f"Timeline id: {timeline.id}")
        if missing:
            print("WARNING unmatched connection names:", sorted(missing))
    finally:
        db.close()


if __name__ == "__main__":
    main()
