import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

export default class LoginPage extends BasePage {
  url = 'graph/login';
  builders = {};
  buttons = {
    login: this.page.getByTestId('data-testid Login button'),
  };
  elements = {};
  inputs = {
    password: this.page.getByTestId('data-testid Password input field'),
    username: this.page.getByTestId('data-testid Username input field'),
  };
  messages = {
    loginFailed: this.page.getByText('Login failed', { exact: true }),
  };

  login = async (password: string, landingUrl: string | RegExp = /help|home-dashboard/) => {
    await this.submitCredentials(password);
    await this.page.waitForURL(landingUrl, { timeout: Timeouts.ONE_MINUTE });
  };

  submitCredentials = async (password: string, username = 'admin') => {
    await this.inputs.username.waitFor({ state: 'visible', timeout: Timeouts.TWENTY_SECONDS });
    await this.inputs.username.fill(username);
    await this.inputs.password.fill(password);
    await this.buttons.login.click();
  };
}
