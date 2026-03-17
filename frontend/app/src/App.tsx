import Layout from "./components/Layout/Layout"
import {Routes,Route} from "react-router-dom"
import Home from "./components/Home/Home"

export default function App() {
  return (
    <>
      <Routes >
        <Route element={<Layout />}>
          <Route path="/" element={<Home />}/>
        </Route>  
      </Routes>    
    </>
  )
}
