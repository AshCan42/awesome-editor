import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import {AwesomeEditor} from './AwesomeEditor';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<AwesomeEditor />, document.getElementById('root'));
registerServiceWorker();
