import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import tailwindcssLogo from './assets/tailwindcss.svg';
import { ipcRenderer, versions } from '#preload';

function App() {
  console.log(versions)
  const [count, setCount] = useState(0);
  return (
    <div className='flex flex-col justify-center items-center text-white h-screen gap-10'>
      <div className='flex gap-14'>
        <a href='https://vitejs.dev' target='_blank'>
          <img className='h-32 w-32 hover:drop-shadow-[0_0_2em_#646cffaa]' src={viteLogo} alt='Vite logo' />
        </a>
        <a href='https://reactjs.org' target='_blank'>
          <img
            className='h-32 w-32 spin hover:drop-shadow-[0_0_2em_#61dafbaa]'
            src={reactLogo}
            alt='React logo'
          />
        </a>
        <a href='https://tailwindcss.com/docs' target='_blank'>
          <img
            className='h-32 w-32 hover:drop-shadow-[0_0_2em_#20d0fcaa]'
            src={tailwindcssLogo}
            alt='React logo'
          />
        </a>
      </div>
      <h1>Vite + React + TailwindCSS</h1>
      <div className='flex gap-10'>

        <button className='border-2 border-transparent py-2 px-5 rounded-lg bg-[#1a1a1a] hover:border-[#646cff] border-animate font-medium' onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button className='border-2 border-transparent py-2 px-5 rounded-lg bg-[#1a1a1a] hover:border-[#646cff] border-animate font-medium'
          onClick={() =>
            ipcRenderer.send('notification', {
              title: 'Electron + Vite + React + TailwindCSS',
              body: `count is: ${count}`,
            })
          }
        >
          Send Notification
        </button>
      </div>
      <div className='flex flex-col items-center'>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
        <p className=''>
          This electron + vite + react + tailwindcss template is created by
          <a href='https://github.com/sunny-dx' target='_blank'>
            <code>
              {' @Sunny-DX'}
            </code>
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
