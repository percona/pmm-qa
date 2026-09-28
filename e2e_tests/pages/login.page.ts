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
  messages = {};

  login = async (password: string) => {
    await this.inputs.username.waitFor({ state: 'visible', timeout: Timeouts.TWENTY_SECONDS });
    await this.inputs.username.fill('admin');
    await this.inputs.password.fill(password);
    await this.buttons.login.click();
    await this.page.waitForURL(/help|home-dashboard/, { timeout: Timeouts.ONE_MINUTE });
  };
}
