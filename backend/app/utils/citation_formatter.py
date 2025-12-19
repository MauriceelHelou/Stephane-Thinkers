"""Citation formatting utilities for generating Chicago, MLA, and APA citations."""

from typing import Optional


def format_authors_chicago(authors: Optional[str], year: Optional[int] = None) -> str:
    """Format author name(s) for Chicago style (Last, First)."""
    if not authors:
        return ""
    # For single author: "Last, First"
    # For multiple authors: "Last, First, and First Last"
    return authors


def format_authors_mla(authors: Optional[str]) -> str:
    """Format author name(s) for MLA style (Last, First)."""
    if not authors:
        return ""
    return authors


def format_authors_apa(authors: Optional[str]) -> str:
    """Format author name(s) for APA style (Last, F.)."""
    if not authors:
        return ""
    return authors


def format_citation_chicago(pub) -> str:
    """
    Generate Chicago (Author-Date) citation format.
    Book: Last, First. Title. Place: Publisher, Year.
    Article: Last, First. "Title." Journal Volume, no. Issue (Year): Pages.
    """
    parts = []

    # Author
    author = pub.authors_text or ""
    if author:
        parts.append(author)
        if not author.endswith("."):
            parts[-1] += "."

    # Title
    if pub.publication_type == "article":
        parts.append(f'"{pub.title}."')
    else:
        parts.append(f"*{pub.title}*.")

    # Journal/Publisher info
    if pub.publication_type == "article" and pub.journal:
        journal_part = f"*{pub.journal}*"
        if pub.volume:
            journal_part += f" {pub.volume}"
        if pub.issue:
            journal_part += f", no. {pub.issue}"
        if pub.year:
            journal_part += f" ({pub.year})"
        if pub.pages:
            journal_part += f": {pub.pages}"
        parts.append(journal_part + ".")
    elif pub.publication_type == "book" and pub.publisher:
        if pub.publisher:
            parts.append(f"{pub.publisher},")
        if pub.year:
            parts.append(f"{pub.year}.")
        else:
            parts[-1] = parts[-1].rstrip(",") + "."
    elif pub.publication_type == "chapter":
        if pub.book_title:
            parts.append(f"In *{pub.book_title}*,")
        if pub.editors:
            parts.append(f"edited by {pub.editors},")
        if pub.pages:
            parts.append(f"{pub.pages}.")
        if pub.publisher:
            parts.append(f"{pub.publisher},")
        if pub.year:
            parts.append(f"{pub.year}.")
    else:
        if pub.year:
            parts.append(f"{pub.year}.")

    # DOI
    if pub.doi:
        parts.append(f"https://doi.org/{pub.doi}")

    return " ".join(parts)


def format_citation_mla(pub) -> str:
    """
    Generate MLA (9th Edition) citation format.
    Book: Last, First. Title. Publisher, Year.
    Article: Last, First. "Title." Journal, vol. X, no. Y, Year, pp. Z-Z.
    """
    parts = []

    # Author
    author = pub.authors_text or ""
    if author:
        parts.append(author)
        if not author.endswith("."):
            parts[-1] += "."

    # Title
    if pub.publication_type == "article":
        parts.append(f'"{pub.title}."')
    else:
        parts.append(f"*{pub.title}*.")

    # Container (Journal/Book)
    if pub.publication_type == "article" and pub.journal:
        parts.append(f"*{pub.journal}*,")
        if pub.volume:
            parts.append(f"vol. {pub.volume},")
        if pub.issue:
            parts.append(f"no. {pub.issue},")
        if pub.year:
            parts.append(f"{pub.year},")
        if pub.pages:
            parts.append(f"pp. {pub.pages}.")
        else:
            parts[-1] = parts[-1].rstrip(",") + "."
    elif pub.publication_type == "book":
        if pub.publisher:
            parts.append(f"{pub.publisher},")
        if pub.year:
            parts.append(f"{pub.year}.")
        else:
            parts[-1] = parts[-1].rstrip(",") + "."
    elif pub.publication_type == "chapter":
        if pub.book_title:
            parts.append(f"*{pub.book_title}*,")
        if pub.editors:
            parts.append(f"edited by {pub.editors},")
        if pub.publisher:
            parts.append(f"{pub.publisher},")
        if pub.year:
            parts.append(f"{pub.year},")
        if pub.pages:
            parts.append(f"pp. {pub.pages}.")
    else:
        if pub.year:
            parts.append(f"{pub.year}.")

    # DOI
    if pub.doi:
        parts.append(f"doi:{pub.doi}.")

    return " ".join(parts)


def format_citation_apa(pub) -> str:
    """
    Generate APA (7th Edition) citation format.
    Book: Last, F. (Year). Title. Publisher.
    Article: Last, F. (Year). Title. Journal, Volume(Issue), Pages. DOI
    """
    parts = []

    # Author
    author = pub.authors_text or ""
    if author:
        parts.append(author)

    # Year
    if pub.year:
        parts.append(f"({pub.year}).")
    else:
        parts.append("(n.d.).")

    # Title
    if pub.publication_type == "article":
        parts.append(f"{pub.title}.")
    else:
        parts.append(f"*{pub.title}*.")

    # Journal/Publisher
    if pub.publication_type == "article" and pub.journal:
        journal_part = f"*{pub.journal}*"
        if pub.volume:
            journal_part += f", {pub.volume}"
        if pub.issue:
            journal_part += f"({pub.issue})"
        if pub.pages:
            journal_part += f", {pub.pages}"
        parts.append(journal_part + ".")
    elif pub.publication_type == "book":
        if pub.publisher:
            parts.append(f"{pub.publisher}.")
    elif pub.publication_type == "chapter":
        if pub.editors:
            parts.append(f"In {pub.editors} (Eds.),")
        if pub.book_title:
            parts.append(f"*{pub.book_title}*")
        if pub.pages:
            parts.append(f"(pp. {pub.pages}).")
        if pub.publisher:
            parts.append(f"{pub.publisher}.")

    # DOI
    if pub.doi:
        parts.append(f"https://doi.org/{pub.doi}")

    return " ".join(parts)


def add_formatted_citations(pub) -> dict:
    """Add formatted citations to a publication dict."""
    pub_dict = pub.__dict__.copy() if hasattr(pub, '__dict__') else dict(pub)

    pub_dict['citation_chicago'] = format_citation_chicago(pub)
    pub_dict['citation_mla'] = format_citation_mla(pub)
    pub_dict['citation_apa'] = format_citation_apa(pub)

    return pub_dict
