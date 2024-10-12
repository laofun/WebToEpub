"use strict";
parserFactory.register("docln.net", () => new _DoclnParser());
parserFactory.register("ln.hako.vn", () => new _DoclnParser());

class _DoclnParser extends Parser {
    constructor() {
        super();
    }
    async getChapterUrls(dom) {
        try {
            const baseOrigin = new URL(dom.baseURI).origin;
            const chapters = [];

            // Lấy tất cả các phần tử volume với lớp .volume-list
            const volumes = dom.querySelectorAll('.volume-list');

            for (const volume of volumes) {
                const header = volume.querySelector('header.sect-header span.sect-title');
                if (!header) continue; // Bỏ qua nếu không tìm thấy header
                const volumeName = header.textContent.trim();

                const chapterItems = volume.querySelectorAll('ul.list-chapters li');
                chapterItems.forEach((chapterItem, index) => {
                    const linkElement = chapterItem.querySelector('a');
                    if (!linkElement) return; // Bỏ qua nếu không tìm thấy liên kết

                    let chapterName = linkElement.textContent.trim();
                    if (index === 0) {
                        chapterName = `[${volumeName}] - ${chapterName}`;
                    }

                    const href = linkElement.getAttribute('href');
                    if (!href) return; // Bỏ qua nếu không tìm thấy href

                    const chapterUrl = new URL(href, baseOrigin).href;

                    chapters.push({
                        sourceUrl: chapterUrl,
                        title: chapterName,
                    });
                    // console.log(chapterUrl, chapterName);
                });
            }

            return chapters;
        } catch (error) {
            console.error('Lỗi khi trích xuất URL chương:', error);
            throw error;
        }
    }



    // title of the story  (not to be confused with title of each chapter    
    extractTitleImpl(dom) {
        // typical implementation is find node with the Title and return name from title
        // NOTE. Can return Title as a string, or an  HTML element
        return dom.querySelector("div.top-part span.series-name a");
    }
    // Optional, supply if cover image can usually be found on inital web page
    // Notes.
    //   1. If cover image is first image in content section, do not implement this function
    findCoverImageUrl(dom) {
        let div = dom.querySelector("div.top-part div.series-cover [style*=background-image]");
        return util.extractUrlFromBackgroundImage(div);
    }
    // Description of the story
    // Optional, Description for metadata, if not provided, will default to ""
    extractDescription(dom) {
        // discard table of contents (will generate one from tags later)
        util.removeElements(dom.querySelectorAll("div.bottom-part .summary-more"));
        return [...dom.querySelectorAll(".summary-wrapper")]
            .map(s => s.textContent.trim())
            .join("\n\n================\n\n");
    }
    // language used
    // Optional, if not provided, will default to ISO code for English "en"
    extractLanguage() {
        return "vi";
    }

    // author of the story
    // Optional, if not provided, will default to "<unknown>"
    extractAuthor(dom) {
        // typical implementation is find node with the author's name and return name from title
        // Major points to note
        //   1. Return the Author's name as a string, not a HTML element
        //   2. If can't find Author, call the base implementation
        let authorLabel = dom.querySelector(
            "div.top-part div.info-item span.info-value"
        );
        return authorLabel === null
            ? super.extractAuthor(dom)
            : authorLabel.textContent;
    }
    // Genre of the story
    // Optional, Genre for metadata, if not provided, will default to ""
    extractSubject(dom) {
        let tags = [...dom.querySelectorAll("a.series-gerne-item")];
        return tags.map(e => e.textContent.trim()).join(", ");
    }
    // Optional, supply if need to modify DOM before normal processing steps
    preprocessRawDom(chapterDom) {
        // remove ads
        util.removeChildElementsMatchingCss(chapterDom, "#chapter-content .flex, #chapter-content div, #chapter-content a");
        util.resolveLazyLoadedImages(chapterDom, "#chapter-content img");
    }

    // Optional, supply if need to chase hyperlinks in page to get all chapter content
    async fetchChapter(url) {
        return (await HttpClient.wrapFetch(url)).responseXML;
    }
    // Optional, supply if individual chapter titles are not inside the content element
    findChapterTitle(dom) {
        // typical implementation is find node with the Title
        // Return Title element, OR the title as a string
        return dom.querySelector("div.title-top h4.title-item").textContent.trim();
    }

    // returns the element holding the story content in a chapter
    findContent(dom) {
        // let content = dom.querySelector("#chapter-content");
        console.log(dom.querySelector("#chapter-content"));
        return dom.querySelector("#chapter-content");
    };
    // Optional, Return elements from page
    // that are to be shown on epub's "information" page

    getInformationEpubItemChildNodes(dom) {
        return [...dom.querySelectorAll("div.book-intro")];
    }
}
