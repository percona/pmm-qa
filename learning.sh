public class Main {
  public static void main(String[] args) {

    // Code here CANNOT use x

    { // change the comment

      // Code here CANNOT use x

      int x = 300;

      // Code here CAN use x
      System.out.println(x);

    } // The block ends here

  // Code here CANNOT use x

  }
}