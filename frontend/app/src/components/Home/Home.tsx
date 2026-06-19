import Hero from "./Hero/Hero"
import Body from "./Body/Body"
import Footer from "./Footer/Footer"
import SeoHead from "../SEO/SeoHead";


export default function Home() {
    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Secret Dinner",
            url: "https://secretdinner.am/",
            logo: "https://secretdinner.am/logo-mark-640.png",
            sameAs: [
                "https://www.instagram.com/secret_dinner_yvn",
                "https://t.me/secret_dinner_bot"
            ]
        },
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Secret Dinner",
            url: "https://secretdinner.am/",
            potentialAction: {
                "@type": "SearchAction",
                target: "https://secretdinner.am/?q={search_term_string}",
                "query-input": "required name=search_term_string"
            }
        },
        {
            "@context": "https://schema.org",
            "@type": "Service",
            serviceType: "Private dining and curated social dinner experience",
            provider: {
                "@type": "Organization",
                name: "Secret Dinner"
            },
            areaServed: "Armenia",
            url: "https://secretdinner.am/"
        }
    ];

    return(
        <>
            <SeoHead
                title="Private Dining Experiences in Armenia"
                description="Secret Dinner hosts curated private dining experiences in Armenia with exclusive venues, refined menus, and meaningful social connections."
                structuredData={structuredData}
            />
            <Hero /> 
            <Body />
            <Footer />
        </>
    )
}
