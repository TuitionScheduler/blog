export type Image = {
    src: string;
    alt?: string;
    caption?: string;
};

export type Link = {
    text: string;
    href: string;
};

export type Hero = {
    title?: string;
    text?: string;
    image?: Image;
    actions?: Link[];
};

export type Subscribe = {
    title?: string;
    text?: string;
    formUrl: string;
};

export type SiteConfig = {
    logo?: Image;
    title: string;
    subtitle?: string;
    description: string;
    image?: Image;
    headerNavLinks?: Link[];
    footerNavLinks?: Link[];
    socialLinks?: Link[];
    hero?: Hero;
    subscribe?: Subscribe;
    postsPerPage?: number;
    projectsPerPage?: number;
};

const siteConfig: SiteConfig = {
    title: 'Matrical',
    subtitle: 'Blog for our UPRM related work',
    description: '',
    // image: {
    //     src: '/dante-preview.jpg',
    //     alt: 'Dante - Astro.js and Tailwind CSS theme'
    // },
    headerNavLinks: [
        {
            text: 'Home',
            href: '/blog'
        },
        {
            text: 'Projects',
            href: '/blog/projects'
        },
        {
            text: 'Blog',
            href: '/blog/articles'
        },
        {
            text: 'Tags',
            href: '/blog/tags'
        }
    ],
    footerNavLinks: [
        {
            text: 'About',
            href: '/blog/about'
        },
        {
            text: 'Contact',
            href: '/blog/contact'
        },
    ],
    socialLinks: [

    ],
    hero: {
        title: 'Welcome to the Matrical Dev Site!',
        text: "Here is where our devs (Kelvin Gonzalez and Alejandro Cruzado) post articles about their work for the University of Puerto Rico at Mayagüez",
        // image: {
        //     src: '/blog/matrical-schedule.jpeg',
        //     alt: 'A calendar with a student\'s courses'
        // },
        actions: [
            {
                text: 'Get in Touch',
                href: '/blog/contact'
            }
        ]
    },
    // subscribe: {
    //     title: 'Subscribe to Dante Newsletter',
    //     text: 'One update per week. All the latest posts directly in your inbox.',
    //     formUrl: '#'
    // },
    postsPerPage: 8,
    projectsPerPage: 8
};

export default siteConfig;
