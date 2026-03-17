import Navbar from "../Navbar/Navbar"
import {Outlet} from "react-router-dom"

export default function Layout() {
    const titles = ["Experience","Tiers","How It Works"]

    return (
        <>
            <Navbar titles={titles} />
            <main>
                <Outlet />
            </main>

        </>
    )
}