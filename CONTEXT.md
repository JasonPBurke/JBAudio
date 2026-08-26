# Sonicbooks

An Android audiobook player. A user points it at folders of audio files; it reads their tags,
groups them into books, plays them, and remembers where they got to.

This file is a **glossary**, not a spec. It says what words mean. It does not say how anything is
built, where any code lives, or what any screen looks like — those belong in `docs/adr/`, the
specs under `.scratch/<feature>/`, and the code itself.

## Language

### The library

**Book**:
One audiobook, as the user thinks of it: a title they can start, finish and see on a shelf. May
be one audio file or many.
_Avoid_: title (ambiguous with the book's name), album, item

**Chapter**:
One playable division of a Book, in the order it is heard. Some come from real markers in the
file; others are generated at fixed intervals when a file has none.
_Avoid_: track, part, segment

**Author**:
The single name a Book is filed under. ⚠ It is one string, and it is only as good as the tags —
narrators and publishers are commonly written into the same field, so a Book's Author is not
reliably a person who wrote it.
_Avoid_: artist, album artist, creator

**Narrator**:
Who reads the Book aloud. A different question from Author, and frequently the answer stored in
the Author field by mistake.

**Series**:
An ordered collection of Books that belong together, either recognised automatically from tags
and folders or assembled by hand. A hand-made one doubles as a playlist.
_Avoid_: collection, set, saga, playlist

**Membership**:
The fact that one Book belongs to one Series, together with its place in the order.
_Avoid_: link, association, join row

**Scan**:
The pass that walks the user's configured folders, reads tags, and brings the library into
agreement with what is on disk — creating, updating and removing Books.
_Avoid_: import, sync, refresh

### Keys and identity

⚠ **Read this cluster before naming anything that identifies a Book or a Series.** Four different
questions live here and three of them have already been misread in ways that nearly changed data
while looking like they changed a display. The rule that follows from that: **name a key after
the question it answers**, never after the shape of its value or the one place it is currently
read.

**Row id**:
Which database row. Churns — editing a Book's tags and rescanning produces a new one — so it
answers no question about identity that outlives a Scan.
_Avoid_: id (unqualified), primary key

**Structural key**:
Which Book, stably across Scans. Derived from the Book's first audio file's path, which survives
tag edits. Moving or renaming a Book's files therefore **ends** its identity, deliberately — see
[ADR 0001](./docs/adr/0001-series-membership-is-keyed-by-file-path.md).
_Avoid_: book key, file key, book id

**Series identity key**:
Whether two Series names denote the same Series. Case- and whitespace-insensitive; a leading
article is **part of it**, so `The Dresden Files` and `Dresden Files` are two different Series.
It is what "that name is already taken" means.
_Avoid_: sort name, normalised name, slug

**Series display order**:
What order Series appear in on screen. Ignores a leading article, so `The Dresden Files` files
under D. ⚠ **A separate question from the identity key, answered by separate code** — folding one
into the other does not reorder anything, it merges two Series into one. See
[ADR 0002](./docs/adr/0002-series-identity-key-is-article-sensitive.md).
_Avoid_: sort key, sort name

### Playback and progress

**Finished**:
The state a Book reaches when the user has heard it. Distinct from "played to the last byte of
audio" — a Book's final minutes are often credits, an advert or a sign-off, which are not the
Book.
_Avoid_: complete, done, read

**Started**:
A Book with listening progress that is not yet Finished.
_Avoid_: in progress, current, playing

**Player**:
The running audio engine: the thing that holds a Queue, has a Position, and keeps playing when the
app's screens are gone. ⚠ Distinct from the *player screen*, which is one view onto it — and from
the several components named after it.
_Avoid_: track player, engine, service

**Active Book**:
The Book the Player currently has loaded, as the Player reports it. ⚠ An observation, not an
instruction: it **lags** a switch, and is only true once the Queue has actually changed.
_Avoid_: current book, active track, now playing

**Requested Book**:
The Book the app has most recently decided to play. Set the moment the user asks, before the Queue
is built, so it **leads** a switch. ⚠ For the length of a switch it disagrees with the Active Book,
and that window is real — code that treats them as one word will be right during steady playback
and wrong exactly when a Book changes.
_Avoid_: active book, selected book, queued book

**Position**:
Where playback has reached. ⚠ What it is measured against depends on how the queue was built —
for some Books it is an offset into the whole Book, for others into one Chapter — so "how far
through?" and "how far into this item?" are different questions.
_Avoid_: progress (which is the user-facing fraction), offset, time

**Queue**:
What the Player has actually been handed to play. It is built from a Book but is not the same
shape as one: a single-file Book may become one item or many, and the same Book can differ
between devices.
_Avoid_: playlist (which is a hand-made Series), tracklist

**Remote control**:
The surfaces outside the app that can command the Player without its UI: the notification, the lock
screen, Android Auto, headset buttons. ⚠ Commands arrive **inbound** — the OS driving the app —
which is the opposite direction from everything else in this section, and conflating the two has
already hidden one defect.
_Avoid_: media session, notification controls, external controls
